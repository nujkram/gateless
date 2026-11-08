require('dotenv').config();

const { Client, GatewayIntentBits, Events, PermissionFlagsBits: P } = require('discord.js');

// What the bot needs to build the server and run the role panels.
const REQUIRED_PERMS = [
  P.ManageRoles,
  P.ManageChannels,
  P.ManageGuild, // AutoMod rules
  P.ViewChannel,
  P.SendMessages,
  P.ReadMessageHistory, // finding the pinned message to update
  P.ManageMessages, // pinning
  P.CreatePublicThreads,
  P.ManageThreads,
  // Discord will not let the bot grant a permission it does not hold, so the
  // invite has to cover everything the Officer role is given in config/roles.js.
  P.KickMembers,
  P.ModerateMembers,
  P.MuteMembers,
  P.MoveMembers,
  P.ManageEvents,
];

const INVITE_BITS = REQUIRED_PERMS.reduce((a, b) => a | b, 0n).toString();

function requireEnv(name, hint) {
  const value = process.env[name];
  if (!value) {
    console.error(`\nMissing ${name} in .env — ${hint}`);
    console.error('Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
  return value;
}

function inviteUrl(clientId) {
  return (
    `https://discord.com/oauth2/authorize?client_id=${clientId}` +
    `&scope=bot%20applications.commands&permissions=${INVITE_BITS}`
  );
}

// Logs in, resolves the one guild we care about, and fails loudly with a
// usable invite link if the bot isn't in it.
async function connect({ intents = [GatewayIntentBits.Guilds] } = {}) {
  const token = requireEnv('DISCORD_TOKEN', 'the bot token from the Developer Portal.');
  const guildId = requireEnv('GUILD_ID', 'right-click the server icon → Copy Server ID.');

  const client = new Client({ intents });
  const ready = new Promise((resolve) => client.once(Events.ClientReady, resolve));
  await client.login(token);
  await ready;

  let guild;
  try {
    guild = await client.guilds.fetch(guildId);
  } catch {
    console.error(`\nThe bot is not in server ${guildId}, or that ID is wrong.`);
    console.error('Open this link as the server owner, then run it again:\n');
    console.error('  ' + inviteUrl(client.user.id) + '\n');
    const inServers = client.guilds.cache.map((g) => `${g.name} (${g.id})`).join(', ');
    console.error(`Servers the bot is currently in: ${inServers || 'none'}`);
    await client.destroy();
    process.exit(1);
  }

  await guild.roles.fetch();
  await guild.members.fetchMe();
  return { client, guild };
}

// Warns about anything missing instead of failing halfway through a run.
function checkPermissions(guild) {
  const me = guild.members.me;
  const missing = REQUIRED_PERMS.filter((p) => !me.permissions.has(p));
  const names = Object.entries(P)
    .filter(([, bit]) => missing.includes(bit))
    .map(([name]) => name);
  return { missing: names, botRole: me.roles.highest };
}

// ── tiny console formatting ────────────────────────────────────────────────
const sym = { add: '+', edit: '~', same: '=', warn: '!', fail: 'x' };
const counts = { add: 0, edit: 0, same: 0, warn: 0, fail: 0 };

function log(kind, what, detail) {
  counts[kind] += 1;
  const line = `  ${sym[kind]} ${what}${detail ? ` — ${detail}` : ''}`;
  (kind === 'fail' || kind === 'warn' ? console.warn : console.log)(line);
}

function section(title) {
  console.log(`\n${title}`);
}

function summary() {
  console.log(
    `\nDone: ${counts.add} created, ${counts.edit} updated, ${counts.same} already correct, ` +
      `${counts.warn} warnings, ${counts.fail} failures.`
  );
  return counts;
}

module.exports = { connect, checkPermissions, inviteUrl, log, section, summary, counts, REQUIRED_PERMS };
