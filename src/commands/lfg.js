// /lfg — suggest who to bring for a dungeon right now.
//
// Order of preference: people who said they need it, longest since they were
// last suggested. Not strongest first. There is no strongest-first here.

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const dungeons = require('../config/dungeons');
const roster = require('../lib/roster');
const { roll } = require('../lib/members');
const { buildParty, describeShortfall } = require('../lib/matching');

const data = new SlashCommandBuilder()
  .setName('lfg')
  .setDescription('Suggest a party for a dungeon from people who still need it')
  .addStringOption((o) =>
    o.setName('dungeon').setDescription('Which content').setRequired(true).addChoices(...dungeons.choices())
  )
  .addBooleanOption((o) =>
    o.setName('private').setDescription('Only show the suggestion to you (default: post it in the channel)')
  );

const line = (c) => {
  const il = c.itemLevel == null ? 'item level not set' : `ilvl ${c.itemLevel.toLocaleString()}`;
  const cls = c.className ?? 'no class picked';
  return `<@${c.userId}> — ${cls}, ${il}`;
};

async function execute(interaction) {
  const dungeon = dungeons.byId(interaction.options.getString('dungeon'));
  const hidden = interaction.options.getBoolean('private') ?? false;

  await interaction.deferReply(hidden ? { flags: MessageFlags.Ephemeral } : {});

  const candidates = await roll(interaction.guild);
  if (!candidates.length) {
    return interaction.editReply(
      'Nobody has recorded any gear yet, so I have nobody to suggest. ' +
        'Ask people to run `/gear set itemlevel:` and `/need toggle`.'
    );
  }

  const result = buildParty(candidates, dungeon);

  const embed = new EmbedBuilder()
    .setTitle(`${dungeon.name} — suggested group`)
    .setColor(result.party.length >= dungeon.size ? 0x5fb58a : 0xd9734e);

  embed.setDescription(
    result.ungated
      ? '_No item level recorded for this content yet, so everyone on the roster is in the running. ' +
          'Set it in `src/config/dungeons.js` once you confirm it in game._'
      : `Game requirement: **${dungeon.itemLevel.toLocaleString()}** item level. That is the only filter applied.`
  );

  if (result.party.length) {
    embed.addFields({
      name: `Party (${result.party.length}/${dungeon.size})`,
      value: result.party.map(line).join('\n'),
    });
  } else {
    embed.addFields({ name: 'Party', value: '_nobody eligible yet_' });
  }

  if (Object.keys(result.shortfall).length) {
    embed.addFields({ name: 'Still short', value: describeShortfall(result.shortfall) });
  }

  if (result.bench.length) {
    embed.addFields({
      name: 'Next up',
      value: result.bench.slice(0, 5).map((c) => `<@${c.userId}>`).join(', '),
    });
  }

  const notes = [];
  if (result.unverified.length) {
    notes.push(
      `${result.unverified.length} member(s) have no item level recorded, so I can't tell if they qualify. ` +
        'They are not excluded — they just need `/gear set`.'
    );
  }
  if (result.underGate.length) {
    notes.push(`${result.underGate.length} member(s) are under the game's own requirement for this content.`);
  }
  if (notes.length) embed.addFields({ name: 'Notes', value: notes.join('\n') });

  embed.setFooter({
    text: 'Ordered by who has waited longest, not by power. Combat power is not read by this command.',
  });

  if (result.party.length) {
    roster.markGrouped(result.party.map((c) => c.userId), dungeon.id);
  }

  return interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute };
