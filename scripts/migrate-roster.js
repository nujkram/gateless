// Copies data/roster.json into Upstash, for the move to Vercel.
//
//   npm run migrate
//
// Needs UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN set — take them
// from the Vercel project's environment variables, or from Upstash directly.
// Existing rows with the same member id are overwritten; anything already in
// Upstash and not in the file is left alone.

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'roster.json');

async function main() {
  const store = require('../src/lib/store');

  if (!store.usingUpstash) {
    console.error('\nUpstash is not configured, so there is nowhere to migrate to.');
    console.error('Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN first.\n');
    process.exit(1);
  }

  let members;
  try {
    members = JSON.parse(fs.readFileSync(FILE, 'utf8')).members ?? {};
  } catch {
    console.error(`\nNo roster to migrate at ${FILE}.\n`);
    process.exit(1);
  }

  const entries = Object.entries(members);
  if (!entries.length) {
    console.log('The local roster is empty — nothing to do.');
    return;
  }

  await store.putMembers(entries);

  console.log(`Copied ${entries.length} member(s) into ${store.describe()}:`);
  for (const [userId, record] of entries) {
    const il = record.itemLevel == null ? 'no item level' : `ilvl ${record.itemLevel}`;
    console.log(`  ${userId} — ${il}, ${record.needs?.length ?? 0} dungeon(s) needed`);
  }

  const after = await store.allMembers();
  console.log(`\nUpstash now holds ${Object.keys(after).length} member(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
