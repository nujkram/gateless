// /need — which dungeons you still want to run.
//
// This is what makes /lfg suggest people who actually want the run, rather
// than whoever happens to be strongest.

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const roster = require('../lib/roster');
const dungeons = require('../config/dungeons');

const data = new SlashCommandBuilder()
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

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'toggle') {
    const id = interaction.options.getString('dungeon');
    const dungeon = dungeons.byId(id);
    if (!dungeon) {
      return interaction.reply({ content: 'I do not know that dungeon.', flags: MessageFlags.Ephemeral });
    }

    const nowNeeds = roster.toggleNeed(interaction.user.id, id);
    const record = roster.get(interaction.user.id);

    const notes = [];
    if (nowNeeds && dungeon.itemLevel != null && record.itemLevel != null && record.itemLevel < dungeon.itemLevel) {
      notes.push(
        `\nHeads up: the game gates **${dungeon.name}** at ${dungeon.itemLevel.toLocaleString()} and you have ` +
          `${record.itemLevel.toLocaleString()} recorded. You'll show up as soon as you're over it — ` +
          'nobody here is filtering you out.'
      );
    }
    if (nowNeeds && record.itemLevel == null) {
      notes.push('\nSet `/gear set itemlevel:` so party suggestions can tell when you qualify.');
    }

    return interaction.reply({
      content: `${nowNeeds ? 'Added' : 'Removed'} **${dungeon.name}**.${notes.join('')}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const record = roster.get(interaction.user.id);
  if (!record.needs.length) {
    return interaction.reply({
      content: 'Nothing on your list. Add one with `/need toggle`.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const lines = record.needs
    .map((id) => dungeons.byId(id))
    .filter(Boolean)
    .map((d) => {
      const gate = d.itemLevel == null ? 'no item level recorded yet' : `${d.itemLevel.toLocaleString()} item level`;
      return `· **${d.name}** — ${gate}`;
    });

  return interaction.reply({
    content: `You still need:\n${lines.join('\n')}`,
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { data, execute };
