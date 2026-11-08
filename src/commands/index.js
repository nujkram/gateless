// Gateway-bot command handlers.
//
// Thin adapters only: every one of these turns a discord.js interaction into
// a call into src/core/, which is the same code the Vercel endpoint runs.
// If you are changing behaviour, change it in src/core/ — not here.

const { MessageFlags } = require('discord.js');

const { DEFINITIONS } = require('../config/commands');
const dungeons = require('../config/dungeons');
const roster = require('../lib/roster');
const { buildPanel, buildGearPanel } = require('../lib/panels');
const { GROUPS } = require('../config/selfroles');
const { profileFromRoleNames } = require('../core/profile');
const gear = require('../core/gear');
const needs = require('../core/needs');
const party = require('../core/party');

const byName = Object.fromEntries(DEFINITIONS.map((d) => [d.name, d]));
const hidden = (payload) => ({ ...payload, flags: MessageFlags.Ephemeral });
const roleNames = (member) => member.roles.cache.map((r) => r.name);

const commands = [
  {
    data: byName.panels,
    async execute(interaction) {
      for (const group of GROUPS) await interaction.channel.send(buildPanel(group));
      await interaction.channel.send(buildGearPanel());
      return interaction.reply(hidden({ content: 'Panels posted.' }));
    },
  },

  {
    data: byName.gear,
    async execute(interaction) {
      if (interaction.options.getSubcommand() === 'set') {
        const itemLevel = interaction.options.getInteger('itemlevel');
        const cp = interaction.options.getInteger('cp');
        if (itemLevel == null && cp == null) {
          return interaction.reply(hidden({ content: 'Give me at least one of **itemlevel** or **cp**.' }));
        }
        return interaction.reply(hidden(await gear.saveGear(interaction.user.id, { itemLevel, combatPower: cp })));
      }

      const target = interaction.options.getUser('member') ?? interaction.user;
      const isSelf = target.id === interaction.user.id;
      const record = await roster.get(target.id);

      let displayName = target.username;
      let className = null;
      try {
        const member = await interaction.guild.members.fetch(target.id);
        displayName = member.displayName;
        className = profileFromRoleNames(roleNames(member)).className;
      } catch {
        /* not in the guild — fall back to what is on record */
      }
      return interaction.reply(hidden(gear.gearView({ record, isSelf, displayName, className })));
    },
  },

  {
    data: byName.need,
    async execute(interaction) {
      const result =
        interaction.options.getSubcommand() === 'list'
          ? await needs.listNeeds(interaction.user.id)
          : await needs.toggleNeed(interaction.user.id, interaction.options.getString('dungeon'));
      return interaction.reply(hidden(result));
    },
  },

  {
    data: byName.lfg,
    async execute(interaction) {
      const dungeon = dungeons.byId(interaction.options.getString('dungeon'));
      const isHidden = interaction.options.getBoolean('private') ?? false;
      await interaction.deferReply(isHidden ? { flags: MessageFlags.Ephemeral } : {});

      const { markIds, ...payload } = await party.lfgPayload(dungeon);
      if (markIds?.length) await roster.markGrouped(markIds, dungeon.id);
      return interaction.editReply(payload);
    },
  },

  {
    data: byName.static,
    async execute(interaction) {
      const sub = interaction.options.getSubcommand();
      if (sub === 'join' || sub === 'leave') {
        return interaction.reply(hidden(await party.setStatic(interaction.user.id, sub === 'join')));
      }

      const allowed = roleNames(interaction.member).some((n) =>
        ['Static Lead', 'Officer', 'Legion Master'].includes(n)
      );
      if (!allowed) {
        return interaction.reply(
          hidden({ content: 'Proposing static rosters is for Static Leads and Officers. You can still `/static join`.' })
        );
      }

      const dungeon = dungeons.byId(interaction.options.getString('content'));
      await interaction.deferReply();
      return interaction.editReply(await party.staticsPayload(dungeon));
    },
  },
];

module.exports = commands;
