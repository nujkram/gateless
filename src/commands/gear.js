// /gear — record and read item level and combat power.
//
// Item level is public: it is the game's own gate and what parties match on.
// Combat power is private. The bot stores it, shows it back to the member who
// set it, and never shows it to anyone else or feeds it to the matcher.

const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const roster = require('../lib/roster');
const { classOf } = require('../lib/members');

const data = new SlashCommandBuilder()
  .setName('gear')
  .setDescription('Record or look up item level and combat power')
  .addSubcommand((s) =>
    s
      .setName('set')
      .setDescription('Record your item level and/or combat power')
      .addIntegerOption((o) =>
        o.setName('itemlevel').setDescription('Your item level — this is what party matching uses').setMinValue(0).setMaxValue(100000)
      )
      .addIntegerOption((o) =>
        o.setName('cp').setDescription('Your combat power — private, only ever shown back to you').setMinValue(0).setMaxValue(100000000)
      )
  )
  .addSubcommand((s) =>
    s
      .setName('show')
      .setDescription('Show recorded gear (combat power only ever shows for yourself)')
      .addUserOption((o) => o.setName('member').setDescription('Whose gear to look up'))
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'set') {
    const itemLevel = interaction.options.getInteger('itemlevel');
    const combatPower = interaction.options.getInteger('cp');

    if (itemLevel == null && combatPower == null) {
      return interaction.reply({
        content: 'Give me at least one of **itemlevel** or **cp**.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const saved = roster.setGear(interaction.user.id, { itemLevel, combatPower });
    const lines = [];
    if (itemLevel != null) lines.push(`Item level: **${itemLevel.toLocaleString()}** — used for party matching.`);
    if (combatPower != null) lines.push(`Combat power: **${combatPower.toLocaleString()}** — private, nobody else can see this.`);
    if (saved.needs.length) lines.push(`\nYou're down for ${saved.needs.length} dungeon(s). \`/need list\` to check.`);

    return interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
  }

  // show
  const target = interaction.options.getUser('member') ?? interaction.user;
  const isSelf = target.id === interaction.user.id;
  const record = roster.get(target.id);

  let member = null;
  try {
    member = await interaction.guild.members.fetch(target.id);
  } catch {
    /* not in the guild */
  }
  const cls = member ? classOf(member) : null;

  const embed = new EmbedBuilder()
    .setTitle(isSelf ? 'Your gear' : `${member?.displayName ?? target.username}'s gear`)
    .setColor(0x4ea1d9)
    .addFields(
      { name: 'Class', value: cls?.name ?? 'not picked', inline: true },
      {
        name: 'Item level',
        value: record.itemLevel == null ? 'not recorded' : record.itemLevel.toLocaleString(),
        inline: true,
      }
    );

  if (isSelf) {
    embed.addFields({
      name: 'Combat power (private)',
      value: record.combatPower == null ? 'not recorded' : record.combatPower.toLocaleString(),
      inline: true,
    });
    embed.setFooter({ text: 'Only you can see your combat power. It is never used to match or rank anyone.' });
  }

  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

module.exports = { data, execute };
