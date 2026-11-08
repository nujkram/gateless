// Builds the button panels for #pick-your-roles. Shared by setup.js (which
// posts them) and bot.js (which re-posts them via /panels).

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { customId } = require('../config/selfroles');
const { OPEN_ID } = require('./gearmodal');

function buildPanel(group) {
  const embed = new EmbedBuilder()
    .setTitle(group.title)
    .setDescription(group.blurb)
    .setColor(group.color);

  const buttons = group.options.map((o) =>
    new ButtonBuilder()
      .setCustomId(customId(group.id, o.id))
      .setLabel(o.label)
      .setStyle(o.style)
      .setEmoji(o.emoji)
  );

  // Discord allows five buttons per row, five rows per message.
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  return { embeds: [embed], components: rows };
}

// The gear panel. One button, which opens a dialog — so nobody has to know
// that /gear set exists, or type a number into a chat box in public.
function buildGearPanel() {
  const embed = new EmbedBuilder()
    .setTitle('Record your gear')
    .setColor(0xe8b64c)
    .setDescription(
      `**Item level** is what party suggestions use. It is the game’s own gate, and the only one we have.

**Combat power** is optional and private. Only you can see it, and it is never used to match, rank or filter anyone — charter rule 1.`
    );

  const button = new ButtonBuilder()
    .setCustomId(OPEN_ID)
    .setLabel('Set item level / CP')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('⚙️');

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] };
}

module.exports = { buildPanel, buildGearPanel };
