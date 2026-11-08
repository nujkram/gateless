// The roster: gear, needs and static interest, per member.
//
// Every function is async because the storage behind it may be a network
// call (Upstash on Vercel) or a file (locally). See src/lib/store.js.
//
// What is stored per member:
//   itemLevel     the game's own gate. Public: this is what parties match on.
//   combatPower   PRIVATE. Shown only to the member who set it. Never used to
//                 sort, filter, rank or exclude anybody — see charter rule 1.
//   needs[]       dungeon ids they still want to run
//   static        whether they want to be placed in a fixed group
//   className     cached from their class role, so /lfg does not have to
//   timezone      fetch every member over REST inside the 3-second window
//   lastGroupedAt when the bot last suggested them, per dungeon, so that
//                 suggestions rotate instead of always naming the same people

const store = require('./store');

const blank = () => ({
  itemLevel: null,
  combatPower: null,
  needs: [],
  static: false,
  className: null,
  timezone: null,
  lastGroupedAt: {},
  updatedAt: null,
});

async function get(userId) {
  return { ...blank(), ...((await store.getMember(userId)) ?? {}) };
}

async function update(userId, patch) {
  const next = {
    ...(await get(userId)),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await store.putMember(userId, next);
  return next;
}

async function setGear(userId, { itemLevel, combatPower }) {
  const patch = {};
  if (itemLevel != null) patch.itemLevel = itemLevel;
  if (combatPower != null) patch.combatPower = combatPower;
  return update(userId, patch);
}

// Keeps the cached class and timezone in step with the member's roles. Called
// whenever we happen to know them, so /lfg can skip per-member REST lookups.
async function cacheProfile(userId, { className, timezone }) {
  const current = await get(userId);
  if (current.className === className && current.timezone === timezone) return current;
  return update(userId, { className, timezone });
}

// Returns the new state so the caller can report "added" or "removed".
async function toggleNeed(userId, dungeonId) {
  const current = await get(userId);
  const needs = current.needs.includes(dungeonId)
    ? current.needs.filter((d) => d !== dungeonId)
    : [...current.needs, dungeonId];
  await update(userId, { needs });
  return needs.includes(dungeonId);
}

async function setStatic(userId, wants) {
  return update(userId, { static: Boolean(wants) });
}

// Called after a suggestion so the same names do not come up every time.
// Reads once and writes once, whatever the party size.
async function markGrouped(userIds, dungeonId) {
  if (!userIds.length) return;
  const now = new Date().toISOString();
  const members = await store.allMembers();
  const entries = userIds.map((userId) => {
    const member = { ...blank(), ...(members[userId] ?? {}) };
    return [userId, { ...member, lastGroupedAt: { ...member.lastGroupedAt, [dungeonId]: now } }];
  });
  await store.putMembers(entries);
}

// [{ userId, ...record }] for everyone who has ever recorded anything.
async function all() {
  const members = await store.allMembers();
  return Object.entries(members).map(([userId, record]) => ({
    userId,
    ...blank(),
    ...record,
  }));
}

module.exports = { get, update, setGear, cacheProfile, toggleNeed, setStatic, markGrouped, all, blank, store };
