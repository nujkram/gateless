// The long-running half of Gateless. It serves the slash commands in
// src/commands/ and answers the self-role buttons in #pick-your-roles.
//
//   npm start
//
// Keep it running. The panels stay visible either way, but a click only does
// something while this process is up. Only one copy may run at a time — see
// src/lib/lock.js for why.

const { Events, MessageFlags } = require('discord.js');

const { parseCustomId, roleNameFor, allSelfRoles } = require('./config/selfroles');
const { connect } = require('./lib/client');
const { acquire } = require('./lib/lock');
const commands = require('./commands');
const roster = require('./lib/roster');
const { buildGearModal, handleGearModal, OPEN_ID, SUBMIT_ID } = require('./lib/gearmodal');

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
  const wanted = roleNameFor(group, option);
  const target = guild.roles.cache.find((r) => r.name === wanted);
  if (!target) {
    trace(interaction, label, `FAILED - no role named "${wanted}"`);
    return interaction.editReply(
      `The **${wanted}** role does not exist yet — ping an Officer to run setup.`
    );
  }

  // Catch the common misconfiguration before Discord does, so the member gets
  // a useful sentence instead of a generic failure.
  const botTop = guild.members.me.roles.highest;
  if (target.position >= botTop.position) {
    trace(interaction, label, `FAILED - "${wanted}" sits above the bot role "${botTop.name}"`);
    return interaction.editReply(
      `I can't assign **${option.label}** — my own role sits below it. An Officer needs to drag ` +
        `**${botTop.name}** above the class roles in Server Settings → Roles.`
    );
  }

  const member = await guild.members.fetch(interaction.user.id);

  // Clicking what you already have always removes it, in every group.
  if (member.roles.cache.has(target.id)) {
    await member.roles.remove(target);
    trace(interaction, label, `removed ${wanted}`);
    return interaction.editReply(`Removed **${option.label}**.`);
  }

  if (!group.exclusive) {
    await member.roles.add(target);
    trace(interaction, label, `added ${wanted} (multi-select)`);
    return interaction.editReply(`Added **${option.label}**.`);
  }

  // Exclusive group: drop the other options in this group first.
  const siblings = group.options
    .filter((o) => o.id !== option.id)
    .map((o) => guild.roles.cache.find((r) => r.name === roleNameFor(group, o)))
    .filter((r) => r && member.roles.cache.has(r.id));

  if (siblings.length) await member.roles.remove(siblings);
  await member.roles.add(target);

  const replaced = siblings.length ? ` (replaced ${siblings.map((r) => r.name).join(', ')})` : '';
  trace(interaction, label, `added ${wanted}${replaced}`);
  return interaction.editReply(`You are now **${option.label}**${replaced}.`);
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
        await interaction.showModal(buildGearModal(roster.get(interaction.user.id)));
        trace(interaction, 'gear/open', 'opened the gear dialog');
        return;
      }

      if (interaction.isModalSubmit() && interaction.customId === SUBMIT_ID) {
        await handleGearModal(interaction);
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

