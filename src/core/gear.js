// Recording and reading gear. Returns message payloads as plain JSON, so the
// gateway bot and the HTTP endpoint can both just send the result.

const { EmbedBuilder } = require('discord.js');
const roster = require('../lib/roster');
const { parseNumber } = require('../lib/gearmodal');

async function saveGear(userId, { itemLevel, combatPower }) {
  const saved = await roster.setGear(userId, { itemLevel, combatPower });

  const lines = [];
  if (itemLevel != null) {
    lines.push(`Item level: **${itemLevel.toLocaleString()}** — used for party matching.`);
  }
  if (combatPower != null) {
    lines.push(`Combat power: **${combatPower.toLocaleString()}** — private, nobody else can see this.`);
  }
  if (!saved.needs.length) {
    lines.push('\nPick what you still need with `/need toggle`.');
  }
  return { content: lines.join('\n') };
}

function gearView({ record, isSelf, displayName, className }) {
  const embed = new EmbedBuilder()
    .setTitle(isSelf ? 'Your gear' : `${displayName}'s gear`)
    .setColor(0x4ea1d9)
    .addFields(
      { name: 'Class', value: className ?? record.className ?? 'not picked', inline: true },
      {
        name: 'Item level',
        value: record.itemLevel == null ? 'not recorded' : record.itemLevel.toLocaleString(),
        inline: true,
      }
    );

  // Combat power is shown to its owner and to nobody else, ever.
  if (isSelf) {
    embed.addFields({
      name: 'Combat power (private)',
      value: record.combatPower == null ? 'not recorded' : record.combatPower.toLocaleString(),
      inline: true,
    });
    embed.setFooter({
      text: 'Only you can see your combat power. It is never used to match or rank anyone.',
    });
  }

  return { embeds: [embed.toJSON()] };
}

// The modal hands back two strings typed by a human. Shared by both
// transports so the validation messages stay identical.
async function applyGearModal(userId, rawItemLevel, rawCp) {
  const itemLevel = parseNumber(rawItemLevel);
  const combatPower = parseNumber(rawCp);

  const bad = [];
  if (itemLevel.error) bad.push('item level');
  if (combatPower.error) bad.push('combat power');
  if (bad.length) {
    return { content: `I could not read your ${bad.join(' or ')} — whole numbers only (commas are fine).` };
  }
  if (itemLevel.empty && combatPower.empty) {
    return { content: 'Both boxes were blank, so nothing changed.' };
  }

  return saveGear(userId, {
    itemLevel: itemLevel.value ?? null,
    combatPower: combatPower.value ?? null,
  });
}

module.exports = { saveGear, gearView, applyGearModal };
