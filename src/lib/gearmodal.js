// The "Set gear" button and the dialog behind it.
//
// A modal has to be the FIRST reply to the button interaction — you cannot
// defer and then show one — so bot.js routes this before its usual deferral.

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require('discord.js');

const roster = require('./roster');

const OPEN_ID = 'gl:gear:open';
const SUBMIT_ID = 'gl:gear:submit';
const FIELD_ITEM_LEVEL = 'itemlevel';
const FIELD_CP = 'cp';

// Accepts "2500", "2,500", " 2 500 ". Rejects anything else, including
// negatives, rather than silently coercing it to a number.
function parseNumber(raw) {
  const cleaned = String(raw ?? '').replace(/[,\s]/g, '');
  if (cleaned === '') return { empty: true };
  if (!/^\d+$/.test(cleaned)) return { error: true };
  return { value: Number(cleaned) };
}

function buildGearModal(record) {
  const itemLevel = new TextInputBuilder()
    .setCustomId(FIELD_ITEM_LEVEL)
    .setLabel('Item level')
    .setPlaceholder('e.g. 2500 — this is what party matching uses')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(12);

  const cp = new TextInputBuilder()
    .setCustomId(FIELD_CP)
    .setLabel('Combat power (private)')
    .setPlaceholder('Only ever shown back to you. Never used to match.')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(12);

  // Pre-fill so the dialog shows what is already on record and an edit is a
  // correction rather than a retype.
  if (record?.itemLevel != null) itemLevel.setValue(String(record.itemLevel));
  if (record?.combatPower != null) cp.setValue(String(record.combatPower));

  return new ModalBuilder()
    .setCustomId(SUBMIT_ID)
    .setTitle('Your gear')
    .addComponents(
      new ActionRowBuilder().addComponents(itemLevel),
      new ActionRowBuilder().addComponents(cp)
    );
}

async function handleGearModal(interaction) {
  const rawItemLevel = interaction.fields.getTextInputValue(FIELD_ITEM_LEVEL);
  const rawCp = interaction.fields.getTextInputValue(FIELD_CP);

  const parsedItemLevel = parseNumber(rawItemLevel);
  const parsedCp = parseNumber(rawCp);

  const bad = [];
  if (parsedItemLevel.error) bad.push('item level');
  if (parsedCp.error) bad.push('combat power');
  if (bad.length) {
    return interaction.reply({
      content: `I could not read your ${bad.join(' or ')} — whole numbers only (commas are fine).`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (parsedItemLevel.empty && parsedCp.empty) {
    return interaction.reply({
      content: 'Both boxes were blank, so nothing changed.',
      flags: MessageFlags.Ephemeral,
    });
  }

  roster.setGear(interaction.user.id, {
    itemLevel: parsedItemLevel.value ?? null,
    combatPower: parsedCp.value ?? null,
  });

  const lines = [];
  if (parsedItemLevel.value != null) {
    lines.push(`Item level: **${parsedItemLevel.value.toLocaleString()}** — used for party matching.`);
  }
  if (parsedCp.value != null) {
    lines.push(`Combat power: **${parsedCp.value.toLocaleString()}** — private, nobody else can see this.`);
  }
  lines.push('\nPick what you still need with `/need toggle`.');

  return interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
}

module.exports = { buildGearModal, handleGearModal, parseNumber, OPEN_ID, SUBMIT_ID, FIELD_ITEM_LEVEL, FIELD_CP };
