// Registers the slash commands with Discord.
//
//   npm run register
//
// Needed once, and again whenever a command's name, options or choices
// change — including when you add a dungeon to src/config/dungeons.js, since
// the choices are baked into the command definition.
//
// Guild-scoped, so changes appear in the server immediately rather than
// propagating globally for up to an hour.

require('dotenv').config();

const { DEFINITIONS, toJSON } = require('../src/config/commands');
const { registerGuildCommands, rest } = require('../src/lib/rest');
const { Routes } = require('discord-api-types/v10');

async function main() {
  const guildId = process.env.GUILD_ID;
  if (!process.env.DISCORD_TOKEN || !guildId) {
    console.error('\nNeed DISCORD_TOKEN and GUILD_ID in .env (or in the environment).');
    process.exit(1);
  }

  // The application id is the bot user's id; ask Discord rather than making
  // you copy another value out of the portal.
  const me = await rest().get(Routes.user('@me'));

  const body = toJSON();
  await registerGuildCommands(me.id, guildId, body);

  console.log(`Registered ${body.length} commands as ${me.username} in guild ${guildId}:`);
  for (const def of DEFINITIONS) console.log(`  /${def.name}`);
  console.log('\nGuild commands apply immediately — no waiting.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
