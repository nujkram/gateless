// Where the roster lives.
//
// Two backends behind one async interface:
//
//   file     a JSON file on disk. Used locally, and by the gateway bot.
//   upstash  Redis over HTTP. Used on Vercel, where the filesystem is
//            ephemeral — anything written there is gone when the function is.
//
// The backend is chosen from the environment, so nothing above this file has
// to know which one is in play. Members are stored as fields of one Redis
// hash, not as one big blob, so two people saving gear at the same moment
// cannot overwrite each other.

const fs = require('fs');
const path = require('path');

const HASH_KEY = 'gateless:roster';
const FILE = path.join(__dirname, '..', '..', 'data', 'roster.json');

// Vercel's marketplace integration sets KV_*; a direct Upstash account sets
// UPSTASH_*. Accept either so neither setup needs special instructions.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const usingUpstash = Boolean(url && token);

// ── upstash ────────────────────────────────────────────────────────────────

// One round trip, one or more commands. Upstash replies with an array of
// { result } | { error } in the order sent.
async function pipeline(commands) {
  const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) {
    throw new Error(`Upstash ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const rows = await res.json();
  return rows.map((row) => {
    if (row.error) throw new Error(`Upstash: ${row.error}`);
    return row.result;
  });
}

const upstash = {
  async getMember(userId) {
    const [raw] = await pipeline([['HGET', HASH_KEY, userId]]);
    return raw ? JSON.parse(raw) : null;
  },
  async putMember(userId, record) {
    await pipeline([['HSET', HASH_KEY, userId, JSON.stringify(record)]]);
  },
  // One round trip for the whole batch. /lfg writes a timestamp for every
  // member it suggests, and doing those one at a time would spend most of
  // Discord's 3-second budget on network latency.
  async putMembers(entries) {
    if (!entries.length) return;
    const args = entries.flatMap(([userId, record]) => [userId, JSON.stringify(record)]);
    await pipeline([['HSET', HASH_KEY, ...args]]);
  },
  async allMembers() {
    const [flat] = await pipeline([['HGETALL', HASH_KEY]]);
    const out = {};
    // HGETALL comes back as [field, value, field, value, ...]
    if (Array.isArray(flat)) {
      for (let i = 0; i < flat.length; i += 2) out[flat[i]] = JSON.parse(flat[i + 1]);
    } else if (flat && typeof flat === 'object') {
      for (const [k, v] of Object.entries(flat)) out[k] = typeof v === 'string' ? JSON.parse(v) : v;
    }
    return out;
  },
};

// ── file ───────────────────────────────────────────────────────────────────

function readFile() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return parsed?.members ?? {};
  } catch {
    return {}; // missing or corrupt: start clean rather than crash
  }
}

function writeFile(members) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, members }, null, 2), 'utf8');
  fs.renameSync(tmp, FILE); // atomic on the same volume
}

const file = {
  async getMember(userId) {
    return readFile()[userId] ?? null;
  },
  async putMember(userId, record) {
    const members = readFile();
    members[userId] = record;
    writeFile(members);
  },
  async putMembers(entries) {
    if (!entries.length) return;
    const members = readFile();
    for (const [userId, record] of entries) members[userId] = record;
    writeFile(members);
  },
  async allMembers() {
    return readFile();
  },
};

const backend = usingUpstash ? upstash : file;

module.exports = {
  ...backend,
  usingUpstash,
  describe: () => (usingUpstash ? `Upstash Redis (${new URL(url).host})` : `file (${FILE})`),
  FILE,
  HASH_KEY,
};
