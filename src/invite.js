// Prints the invite link with exactly the permissions this project needs,
// so you never have to hunt for your Application ID.
//
//   npm run invite          the precise scope (14 permissions)
//   npm run invite -- --admin   Administrator, easiest for a brand-new server
//
// Needs DISCORD_TOKEN in .env. GUILD_ID is not required yet.

require('dotenv').config();

const { Client, GatewayIntentBits, Events, PermissionFlagsBits: P } = require('discord.js');
const { REQUIRED_PERMS } = require('./lib/client');

const ADMIN = process.argv.includes('--admin');

async function main() {
  if (!process.env.DISCORD_TOKEN) {
    console.error('\nMissing DISCORD_TOKEN in .env.');
    console.error('Copy .env.example to .env and paste the token from');
    console.error('https://discord.com/developers/applications > your app > Bot > Reset Token\n');
    process.exit(1);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const ready = new Promise((resolve) => client.once(Events.ClientReady, resolve));

  try {
    await client.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    console.error(`\nDiscord rejected that token: ${err.message}`);
    console.error('Reset it in the Developer Portal and paste the new one into .env.\n');
    process.exit(1);
  }
  await ready;

  const bits = ADMIN ? P.Administrator : REQUIRED_PERMS.reduce((a, b) => a | b, 0n);
  const url =
    `https://discord.com/oauth2/authorize?client_id=${client.user.id}` +
    `&scope=bot%20applications.commands&permissions=${bits}`;

  console.log(`\nBot:   ${client.user.tag}`);
  console.log(`Scope: ${ADMIN ? 'Administrator' : `${REQUIRED_PERMS.length} specific permissions`}`);
  console.log('\nOpen this as the server owner:\n');
  console.log('  ' + url + '\n');

  if (!ADMIN) {
    console.log('If setup later warns that it could not grant Administrator to');
    console.log('Legion Master, re-run with:  npm run invite -- --admin\n');
  }

  await client.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
