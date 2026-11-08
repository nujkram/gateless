// The roster store: one JSON file, loaded on demand and written atomically.
//
// A legion is tens to low hundreds of people, so a file is the right size of
// tool — no native dependency, and you can open it, read it and back it up
// without any of my code involved.
//
// What is stored per member:
//   itemLevel     the game's own gate. Public: this is what parties match on.
//   combatPower   PRIVATE. Shown only to the member who set it. Never used to
//                 sort, filter, rank or exclude anybody — see charter rule 1.
//   needs[]       dungeon ids they still want to run
//   static        whether they want to be placed in a fixed group
//   lastGroupedAt when the bot last suggested them, per dungeon, so that
//                 suggestions rotate instead of always naming the same people

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'roster.json');
const VERSION = 1;

const empty = () => ({ version: VERSION, members: {} });

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || !parsed.members) return empty();
    return { version: parsed.version ?? VERSION, members: parsed.members };
  } catch {
    // Missing or corrupt: start clean rather than crashing the bot. The file
    // is never the source of truth for anything irreplaceable.
    return empty();
  }
}

function save(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, FILE); // atomic on the same volume
}

const blank = () => ({
  itemLevel: null,
  combatPower: null,
  needs: [],
  static: false,
  lastGroupedAt: {},
  updatedAt: null,
});

function get(userId) {
  const db = load();
  return { ...blank(), ...(db.members[userId] ?? {}) };
}

function update(userId, patch) {
  const db = load();
  const next = { ...blank(), ...(db.members[userId] ?? {}), ...patch, updatedAt: new Date().toISOString() };
  db.members[userId] = next;
  save(db);
  return next;
}

function setGear(userId, { itemLevel, combatPower }) {
  const patch = {};
  if (itemLevel != null) patch.itemLevel = itemLevel;
  if (combatPower != null) patch.combatPower = combatPower;
  return update(userId, patch);
}

// Returns the new state so the caller can report "added" or "removed".
function toggleNeed(userId, dungeonId) {
  const current = get(userId);
  const needs = current.needs.includes(dungeonId)
    ? current.needs.filter((d) => d !== dungeonId)
    : [...current.needs, dungeonId];
  update(userId, { needs });
  return needs.includes(dungeonId);
}

function setStatic(userId, wants) {
  return update(userId, { static: Boolean(wants) });
}

// Called after a suggestion so the same names do not come up every time.
function markGrouped(userIds, dungeonId) {
  const db = load();
  const now = new Date().toISOString();
  for (const userId of userIds) {
    const member = { ...blank(), ...(db.members[userId] ?? {}) };
    member.lastGroupedAt = { ...member.lastGroupedAt, [dungeonId]: now };
    db.members[userId] = member;
  }
  save(db);
}

// [{ userId, ...record }] for everyone who has ever recorded anything.
function all() {
  const db = load();
  return Object.entries(db.members).map(([userId, record]) => ({
    userId,
    ...blank(),
    ...record,
  }));
}

module.exports = { get, update, setGear, toggleNeed, setStatic, markGrouped, all, load, save, FILE, blank };
