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
// UPSTASH_*. Vercel also lets you give a store an environment-variable
// prefix, which turns KV_REST_API_URL into e.g. STORAGE_KV_REST_API_URL —
// so match on the suffix rather than insisting on an exact name, or a
// perfectly good database looks absent.
//
// Note the token suffix does NOT match KV_REST_API_READ_ONLY_TOKEN, which
// would connect happily and then fail on the first write.
const URL_SUFFIXES = ['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL'];
const TOKEN_SUFFIXES = ['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN'];

function findEnv(suffixes) {
  for (const suffix of suffixes) {
    // An exact name wins over a prefixed one.
    if (process.env[suffix]) return { name: suffix, value: process.env[suffix] };
    const match = Object.keys(process.env)
      .filter((k) => k.endsWith(`_${suffix}`) && process.env[k])
      .sort()[0];
    if (match) return { name: match, value: process.env[match] };
  }
  return { name: null, value: null };
}

const found = { url: findEnv(URL_SUFFIXES), token: findEnv(TOKEN_SUFFIXES) };
const url = found.url.value;
const token = found.token.value;

const usingUpstash = Boolean(url && token);

// Names only — never values. The health endpoint reports these so a
// misnamed or half-connected store is visible instead of silent.
const storageEnvNames = () => ({
  url: found.url.name,
  token: found.token.name,
  candidates: Object.keys(process.env)
    .filter((k) => /(KV_REST|UPSTASH)/i.test(k))
    .sort(),
});

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

// Does the storage actually WORK, not just "are the variables present".
// A wrong token, a deleted database or a typo'd URL all look identical from
// the environment alone, so the health endpoint asks the database itself.
// HLEN is cheap and returns no member data.
async function probe() {
  if (!usingUpstash) return { ok: true, backend: 'file' };
  try {
    const [count] = await pipeline([['HLEN', HASH_KEY]]);
    return { ok: true, backend: 'upstash', members: Number(count) || 0 };
  } catch (err) {
    // Surface the shape of the failure, not the credentials in it.
    return { ok: false, backend: 'upstash', error: String(err.message).slice(0, 120) };
  }
}

const backend = usingUpstash ? upstash : file;

module.exports = {
  ...backend,
  usingUpstash,
  storageEnvNames,
  probe,
  describe: () => (usingUpstash ? `Upstash Redis (${new URL(url).host})` : `file (${FILE})`),
  FILE,
  HASH_KEY,
};
