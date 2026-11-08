// The "Set gear" button and the dialog behind it.
//
// A modal has to be the FIRST reply to the button interaction — you cannot
// defer and then show one — so both transports route this before anything
// that would reply with a message.
//
// What to do with the submitted values lives in src/core/gear.js, so the
// gateway bot and the Vercel endpoint validate identically.

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');


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

module.exports = { buildGearModal, parseNumber, OPEN_ID, SUBMIT_ID, FIELD_ITEM_LEVEL, FIELD_CP };
