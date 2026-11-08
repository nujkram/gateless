// The content the bot can build parties for.
//
// ─────────────────────────────────────────────────────────────────────────
//  IMPORTANT: the item levels below are mostly BLANK on purpose.
//
//  The only figure I had from you is Transcendence Stage 4 at 2,500, from the
//  LFG template in the blueprint. I have not invented the others, because a
//  wrong number here becomes a gate that keeps eligible people out — exactly
//  what charter rule 1 exists to prevent.
//
//  Fill in `itemLevel` from the game as you confirm each one. Until then the
//  bot treats a null as "no requirement recorded" and says so openly rather
//  than filtering anyone out.
// ─────────────────────────────────────────────────────────────────────────
//
// `shape` is the party composition to aim for. It balances a group; it never
// ranks the people in it.

const PARTY = { tank: 1, healer: 1, flex: 4 };   // 6-player
const RAID = { tank: 2, healer: 2, flex: 6 };    // 10-player

const DUNGEONS = [
  // id              name                        itemLevel  size  shape
  { id: 'expedition',   name: 'Expedition',            itemLevel: null, size: 6,  shape: PARTY, kind: 'dungeon' },
  { id: 'sanctuary',    name: 'Sanctuary',             itemLevel: null, size: 6,  shape: PARTY, kind: 'dungeon' },
  { id: 'transcend-1',  name: 'Transcendence Stage 1', itemLevel: null, size: 6,  shape: PARTY, kind: 'dungeon' },
  { id: 'transcend-2',  name: 'Transcendence Stage 2', itemLevel: null, size: 6,  shape: PARTY, kind: 'dungeon' },
  { id: 'transcend-3',  name: 'Transcendence Stage 3', itemLevel: null, size: 6,  shape: PARTY, kind: 'dungeon' },
  { id: 'transcend-4',  name: 'Transcendence Stage 4', itemLevel: 2500, size: 6,  shape: PARTY, kind: 'dungeon' },
  { id: 'ludra-normal', name: 'Ludra (Normal)',        itemLevel: null, size: 10, shape: RAID,  kind: 'raid' },
  { id: 'ludra-hard',   name: 'Ludra (Hard)',          itemLevel: null, size: 10, shape: RAID,  kind: 'raid' },
];

const byId = (id) => DUNGEONS.find((d) => d.id === id) ?? null;

// Discord slash-command choices cap at 25, which this comfortably fits.
const choices = () => DUNGEONS.map((d) => ({ name: d.name, value: d.id }));

// True when we have no recorded requirement, so nobody should be filtered out.
const isUngated = (dungeon) => dungeon.itemLevel == null;

module.exports = { DUNGEONS, PARTY, RAID, byId, choices, isUngated };
