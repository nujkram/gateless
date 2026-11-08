// /static — opt into a fixed group, and propose balanced rosters.
//
// Statics are grouped by timezone first: a fixed group that can never agree
// on a time is not a fixed group.

const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const dungeons = require('../config/dungeons');
const roster = require('../lib/roster');
const { roll } = require('../lib/members');
const { buildStatics, describeShortfall } = require('../lib/matching');

const data = new SlashCommandBuilder()
  .setName('static')
  .setDescription('Fixed groups: opt in, opt out, or propose rosters')
  .addSubcommand((s) => s.setName('join').setDescription('Put yourself forward for a static'))
  .addSubcommand((s) => s.setName('leave').setDescription('Take yourself out of static consideration'))
  .addSubcommand((s) =>
    s
      .setName('build')
      .setDescription('Propose static rosters from everyone who opted in')
      .addStringOption((o) =>
        o.setName('content').setDescription('What the static is for').setRequired(true).addChoices(...dungeons.choices())
      )
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'join' || sub === 'leave') {
    const wants = sub === 'join';
    roster.setStatic(interaction.user.id, wants);
    const record = roster.get(interaction.user.id);
    const nudge =
      wants && record.itemLevel == null
        ? '\nSet `/gear set itemlevel:` so I can place you in the right content.'
        : '';
    return interaction.reply({
      content: wants
        ? `You're in the pool for a static.${nudge}`
        : "You're out of the static pool.",
      flags: MessageFlags.Ephemeral,
    });
  }

  // build — proposing rosters is a Static Lead / Officer job
  const canBuild =
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) ||
    interaction.member?.roles?.cache?.some((r) => ['Static Lead', 'Officer', 'Legion Master'].includes(r.name));

  if (!canBuild) {
    return interaction.reply({
      content: 'Proposing static rosters is for Static Leads and Officers. You can still `/static join`.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const dungeon = dungeons.byId(interaction.options.getString('content'));
  await interaction.deferReply();

  const candidates = await roll(interaction.guild);
  const { groups, leftover } = buildStatics(candidates, dungeon);

  if (!groups.length && !leftover.length) {
    return interaction.editReply(
      'Nobody has opted into a static yet. Point people at `/static join`.'
    );
  }

  const embed = new EmbedBuilder()
    .setTitle(`Proposed statics — ${dungeon.name}`)
    .setColor(0x7e6bd9)
    .setDescription(
      groups.length
        ? `${groups.length} full group(s) of ${dungeon.size}, grouped by timezone.`
        : 'Not enough people in any one timezone to fill a group yet.'
    );

  groups.slice(0, 10).forEach((group, i) => {
    embed.addFields({
      name: `Group ${i + 1} — ${group.timezone}`,
      value: group.members
        .map((m) => `<@${m.userId}> — ${m.className ?? 'no class'}`)
        .join('\n'),
    });
  });

  if (leftover.length) {
    embed.addFields({
      name: `Not placed (${leftover.length})`,
      value:
        leftover.slice(0, 15).map((m) => `<@${m.userId}> — ${m.timezone ?? 'no timezone'}`).join('\n') +
        (leftover.length > 15 ? `\n…and ${leftover.length - 15} more` : ''),
    });
  }

  embed.setFooter({
    text: 'Grouped by timezone and class balance. Combat power is not read by this command.',
  });

  return interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute };
