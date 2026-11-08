// Slash command definitions, in one place.
//
// Used by scripts/register-commands.js (for the Vercel deployment) and by
// the gateway bot. Definitions only — the behaviour lives in src/core/, so
// both transports run exactly the same logic.

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const dungeons = require('./dungeons');

const gear = new SlashCommandBuilder()
  .setName('gear')
  .setDescription('Record or look up item level and combat power')
  .addSubcommand((s) =>
    s
      .setName('set')
      .setDescription('Record your item level and/or combat power')
      .addIntegerOption((o) =>
        o
          .setName('itemlevel')
          .setDescription('Your item level — this is what party matching uses')
          .setMinValue(0)
          .setMaxValue(100000)
      )
      .addIntegerOption((o) =>
        o
          .setName('cp')
          .setDescription('Your combat power — private, only ever shown back to you')
          .setMinValue(0)
          .setMaxValue(100000000)
      )
  )
  .addSubcommand((s) =>
    s
      .setName('show')
      .setDescription('Show recorded gear (combat power only ever shows for yourself)')
      .addUserOption((o) => o.setName('member').setDescription('Whose gear to look up'))
  );

const need = new SlashCommandBuilder()
  .setName('need')
  .setDescription('Track which dungeons you still need')
  .addSubcommand((s) =>
    s
      .setName('toggle')
      .setDescription('Add or remove a dungeon from your list')
      .addStringOption((o) =>
        o.setName('dungeon').setDescription('Which one').setRequired(true).addChoices(...dungeons.choices())
      )
  )
  .addSubcommand((s) => s.setName('list').setDescription('Show your current list'));

const lfg = new SlashCommandBuilder()
  .setName('lfg')
  .setDescription('Suggest a party for a dungeon from people who still need it')
  .addStringOption((o) =>
    o.setName('dungeon').setDescription('Which content').setRequired(true).addChoices(...dungeons.choices())
  )
  .addBooleanOption((o) =>
    o.setName('private').setDescription('Only show the suggestion to you (default: post it in the channel)')
  );

const statics = new SlashCommandBuilder()
  .setName('static')
  .setDescription('Fixed groups: opt in, opt out, or propose rosters')
  .addSubcommand((s) => s.setName('join').setDescription('Put yourself forward for a static'))
  .addSubcommand((s) => s.setName('leave').setDescription('Take yourself out of static consideration'))
  .addSubcommand((s) =>
    s
      .setName('build')
      .setDescription('Propose static rosters from everyone who opted in')
      .addStringOption((o) =>
        o
          .setName('content')
          .setDescription('What the static is for')
          .setRequired(true)
          .addChoices(...dungeons.choices())
      )
  );

const panels = new SlashCommandBuilder()
  .setName('panels')
  .setDescription('Re-post the class, content, timezone and gear panels in this channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

const DEFINITIONS = [panels, gear, need, lfg, statics];

module.exports = { DEFINITIONS, gear, need, lfg, statics, panels, toJSON: () => DEFINITIONS.map((d) => d.toJSON()) };
