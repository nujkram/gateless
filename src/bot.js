// The long-running half of Gateless. It serves the slash commands in
// src/commands/ and answers the self-role buttons in #pick-your-roles.
//
//   npm start
//
// Keep it running. The panels stay visible either way, but a click only does
// something while this process is up. Only one copy may run at a time — see
// src/lib/lock.js for why.

const { Events, MessageFlags } = require('discord.js');

const { parseCustomId, allSelfRoles } = require('./config/selfroles');
const { connect } = require('./lib/client');
const { acquire } = require('./lib/lock');
const commands = require('./commands');
const roster = require('./lib/roster');
const { buildGearModal, OPEN_ID, SUBMIT_ID, FIELD_ITEM_LEVEL, FIELD_CP } = require('./lib/gearmodal');
const { planSelfRole } = require('./core/selfrole');
const { profileFromRoleNames } = require('./core/profile');
const { applyGearModal } = require('./core/gear');

// Reports what the bot can and cannot assign. Never changes anything.
function auditSelfRoles(guild) {
  const botTop = guild.members.me.roles.highest;
  const rows = allSelfRoles().map(({ name }) => {
    const role = guild.roles.cache.find((r) => r.name === name);
    if (!role) return { name, status: 'MISSING', note: 'run `npm run setup`' };
    if (role.managed) return { name, status: 'BLOCKED', note: 'integration-managed role' };
    if (role.position >= botTop.position) {
      return { name, status: 'BLOCKED', note: `sits above the bot role "${botTop.name}"` };
    }
    return { name, status: 'OK', role };
  });
  return rows;
}

const ts = () => new Date().toLocaleTimeString();

// Every click prints one line. Role changes are invisible from the terminal
// otherwise, and "the button did nothing" is impossible to diagnose without it.
function trace(interaction, label, outcome) {
  console.log(`[${ts()}] ${interaction.user.tag.padEnd(20)} ${label.padEnd(22)} ${outcome}`);
}

async function handleButton(interaction) {
  const parsed = parseCustomId(interaction.customId);
  if (!parsed) {
    console.warn(`[${ts()}] ignored unknown button id: ${interaction.customId}`);
    return;
  }
  const { group, option } = parsed;
  const label = `${group.id}/${option.id}`;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild;
  const member = await guild.members.fetch(interaction.user.id);
  const currentNames = member.roles.cache.map((r) => r.name);

  // Same decision the Vercel endpoint makes, from the same function.
  const plan = planSelfRole(group.id, option.id, currentNames);
  if (!plan) return interaction.editReply('That button is not one of mine.');

  const resolve = (name) => guild.roles.cache.find((r) => r.name === name);
  const missing = [...plan.add, ...plan.remove].filter((name) => !resolve(name));
  if (missing.length) {
    trace(interaction, label, `FAILED - no role named "${missing[0]}"`);
    return interaction.editReply(
      `The **${missing[0]}** role does not exist yet — ping an Officer to run setup.`
    );
  }

  // Catch the common misconfiguration before Discord does, so the member gets
  // a useful sentence instead of a generic failure.
  const botTop = guild.members.me.roles.highest;
  const tooHigh = [...plan.add, ...plan.remove].find((name) => resolve(name).position >= botTop.position);
  if (tooHigh) {
    trace(interaction, label, `FAILED - "${tooHigh}" sits above the bot role "${botTop.name}"`);
    return interaction.editReply(
      `I can't change **${option.label}** — my own role sits below **${tooHigh}**. An Officer needs ` +
        `to drag **${botTop.name}** above the class roles in Server Settings → Roles.`
    );
  }

  if (plan.remove.length) await member.roles.remove(plan.remove.map(resolve));
  if (plan.add.length) await member.roles.add(plan.add.map(resolve));

  // Keep the cached class and timezone in step, so /lfg does not need a REST
  // lookup per member later.
  const after = currentNames.filter((n) => !plan.remove.includes(n)).concat(plan.add);
  await roster.cacheProfile(interaction.user.id, profileFromRoleNames(after));

  trace(interaction, label, plan.content.replace(/\*\*/g, ''));
  return interaction.editReply(plan.content);
}

async function main() {
  // Before anything touches Discord: refuse to be the second copy.
  acquire();

  const { client, guild } = await connect();
  console.log(`Logged in as ${client.user.tag} — serving ${guild.name}`);

  await guild.commands.set(commands.map((c) => c.data.toJSON()));
  console.log(`Registered ${commands.map((c) => '/' + c.data.name).join(' ')}`);

  console.log('\nSelf-role check:');
  let blocked = 0;
  for (const { name, status, note } of auditSelfRoles(guild)) {
    if (status !== 'OK') {
      blocked += 1;
      console.warn(`  [${status.padEnd(7)}] ${name} — ${note}`);
    }
  }
  console.log(blocked ? `  ${blocked} role(s) need attention.` : '  All self-roles assignable.');

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.guildId !== guild.id) return;
    try {
      if (interaction.isChatInputCommand()) {
        const command = commands.find((c) => c.data.name === interaction.commandName);
        if (!command) return;
        const t0 = Date.now();
        await command.execute(interaction);
        console.log(
          `[${ts()}] ${interaction.user.tag.padEnd(20)} /${interaction.commandName.padEnd(21)} ` +
            `ok (${Date.now() - t0}ms)`
        );
        return;
      }
      // The gear button opens a dialog. A modal must be the FIRST response to
      // the interaction, so this has to come before handleButton's deferral.
      if (interaction.isButton() && interaction.customId === OPEN_ID) {
        await interaction.showModal(buildGearModal(await roster.get(interaction.user.id)));
        trace(interaction, 'gear/open', 'opened the gear dialog');
        return;
      }

      if (interaction.isModalSubmit() && interaction.customId === SUBMIT_ID) {
        const result = await applyGearModal(
          interaction.user.id,
          interaction.fields.getTextInputValue(FIELD_ITEM_LEVEL),
          interaction.fields.getTextInputValue(FIELD_CP)
        );
        await interaction.reply({ ...result, flags: MessageFlags.Ephemeral });
        trace(interaction, 'gear/submit', 'saved from the dialog');
        return;
      }

      if (interaction.isButton()) await handleButton(interaction);
    } catch (err) {
      // 10062 means Discord had already closed this interaction by the time we
      // answered. With a 3-second acknowledgement window and a defer as the
      // very first call, the overwhelmingly likely cause is a SECOND copy of
      // this bot running on the same token: both receive the click, the faster
      // one acknowledges, and the slower one gets this. A full stack trace
      // buries that, so say it plainly instead.
      if (err.code === 10062) {
        console.error(
          `[${ts()}] Unknown interaction on ${interaction.customId} — something answered this click first.`
        );
        console.error('         Almost always a second `npm start` still running in another terminal.');
        console.error('         Stop every copy of the bot, then start exactly one.');
        return;
      }
      console.error(`[${ts()}] ERROR on ${interaction.customId ?? interaction.commandName} ` +
        `(code ${err.code ?? 'none'}): ${err.message}`);
      console.error(err);
      const msg =
        'Something went wrong — the bot most likely needs Manage Roles, or its role sits below the role you clicked.';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(msg).catch(() => {});
      } else if (interaction.isRepliable()) {
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { auditSelfRoles, handleButton };

