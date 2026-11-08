// Party-building rules. No Discord, no network.
// Run with: node test/matching.js

const assert = require('assert');
const { buildParty, buildStatics, classify, describeShortfall } = require('../src/lib/matching');
const { byId, PARTY } = require('../src/config/dungeons');

let checks = 0;
const check = (label, fn) => {
  fn();
  checks += 1;
  console.log(`  ok  ${label}`);
};

const gated = byId('transcend-4');      // itemLevel 2500, 6-player
const ungated = byId('expedition');     // itemLevel null, 6-player
const raid = byId('ludra-normal');      // itemLevel null, 10-player

// Compact candidate factory.
let seq = 0;
const who = (over = {}) => ({
  userId: over.userId ?? `u${String(++seq).padStart(2, '0')}`,
  displayName: 'member',
  className: 'Ranger',
  archetype: 'dps',
  timezone: 'GMT+8',
  itemLevel: 3000,
  needs: [],
  static: false,
  lastGroupedAt: {},
  ...over,
});

const sixDps = () => Array.from({ length: 6 }, () => who());

console.log('\nEligibility');

check('item level at or above the game gate is eligible', () => {
  const { eligible, underGate } = classify([who({ itemLevel: 2500 }), who({ itemLevel: 2499 })], gated);
  assert.strictEqual(eligible.length, 1);
  assert.strictEqual(underGate.length, 1);
});

check('no recorded item level is "unverified", not "excluded"', () => {
  const { eligible, unverified, underGate } = classify([who({ itemLevel: null })], gated);
  assert.strictEqual(unverified.length, 1);
  assert.strictEqual(eligible.length, 0);
  assert.strictEqual(underGate.length, 0, 'unknown must never be filed as too weak');
});

check('content with no recorded requirement gates nobody', () => {
  const { eligible, underGate, unverified } = classify(
    [who({ itemLevel: 1 }), who({ itemLevel: null })],
    ungated
  );
  assert.strictEqual(eligible.length, 2);
  assert.strictEqual(underGate.length, 0);
  assert.strictEqual(unverified.length, 0);
});

console.log('\nCharter rule 1: combat power never matters');

check('combat power on a candidate cannot change the result', () => {
  const base = sixDps().map((c, i) => ({ ...c, userId: `x${i}` }));
  const plain = buildParty(base, ungated);
  const loaded = buildParty(
    base.map((c, i) => ({ ...c, combatPower: (6 - i) * 1000000 })),
    ungated
  );
  assert.deepStrictEqual(
    plain.party.map((c) => c.userId),
    loaded.party.map((c) => c.userId),
    'adding combat power changed the party — the matcher is reading it'
  );
});

check('a higher item level does not buy a better seat', () => {
  const low = who({ userId: 'a-low', itemLevel: 2500, lastGroupedAt: {} });
  const high = who({ userId: 'b-high', itemLevel: 9999, lastGroupedAt: { [gated.id]: '2026-11-07T00:00:00Z' } });
  const { party } = buildParty([high, low], gated);
  assert.strictEqual(party[0].userId, 'a-low', 'the one who waited longer should come first');
});

console.log('\nWho gets offered');

check('people who need the dungeon come before fillers', () => {
  const filler = who({ userId: 'filler' });
  const needer = who({ userId: 'needer', needs: [ungated.id] });
  const { party } = buildParty([filler, needer], ungated);
  assert.strictEqual(party[0].userId, 'needer');
});

check('longest since last suggested comes first', () => {
  const recent = who({ userId: 'recent', lastGroupedAt: { [ungated.id]: '2026-11-07T10:00:00Z' } });
  const older = who({ userId: 'older', lastGroupedAt: { [ungated.id]: '2026-01-01T10:00:00Z' } });
  const never = who({ userId: 'never' });
  const { party } = buildParty([recent, older, never], ungated);
  assert.deepStrictEqual(party.map((c) => c.userId), ['never', 'older', 'recent']);
});

console.log('\nParty shape');

check('a tank and a healer are seated before flex', () => {
  const pool = [
    ...Array.from({ length: 6 }, (_, i) => who({ userId: `dps${i}`, archetype: 'dps' })),
    who({ userId: 'tank', archetype: 'tank', className: 'Templar' }),
    who({ userId: 'healer', archetype: 'healer', className: 'Cleric' }),
  ];
  const { party, shortfall } = buildParty(pool, ungated);
  assert.strictEqual(party.length, 6);
  assert.ok(party.some((c) => c.archetype === 'tank'), 'no tank seated');
  assert.ok(party.some((c) => c.archetype === 'healer'), 'no healer seated');
  assert.deepStrictEqual(shortfall, {});
});

check('a missing tank is reported, not silently ignored', () => {
  const { shortfall } = buildParty(sixDps(), ungated);
  assert.strictEqual(shortfall.tank, 1);
  assert.strictEqual(shortfall.healer, 1);
  assert.ok(describeShortfall(shortfall).includes('tank'));
});

check('too few people reports how many more are needed', () => {
  const { party, shortfall } = buildParty([who({ archetype: 'tank' }), who({ archetype: 'healer' })], ungated);
  assert.strictEqual(party.length, 2);
  assert.strictEqual(shortfall.any, 4);
});

check('nobody is seated twice', () => {
  const { party } = buildParty(sixDps(), ungated);
  assert.strictEqual(new Set(party.map((c) => c.userId)).size, party.length);
});

check('a 10-player raid asks for two tanks and two healers', () => {
  const pool = [
    ...Array.from({ length: 10 }, (_, i) => who({ userId: `d${i}`, archetype: 'dps' })),
    who({ userId: 't1', archetype: 'tank' }),
    who({ userId: 't2', archetype: 'tank' }),
    who({ userId: 'h1', archetype: 'healer' }),
    who({ userId: 'h2', archetype: 'healer' }),
  ];
  const { party, shortfall } = buildParty(pool, raid);
  assert.strictEqual(party.length, 10);
  assert.strictEqual(party.filter((c) => c.archetype === 'tank').length, 2);
  assert.strictEqual(party.filter((c) => c.archetype === 'healer').length, 2);
  assert.deepStrictEqual(shortfall, {});
});

console.log('\nStatics');

check('groups form within a timezone and the rest are reported', () => {
  const ph = Array.from({ length: 6 }, (_, i) => who({ userId: `ph${i}`, timezone: 'GMT+8', static: true }));
  const eu = Array.from({ length: 2 }, (_, i) => who({ userId: `eu${i}`, timezone: 'Other', static: true }));
  const { groups, leftover } = buildStatics([...ph, ...eu], ungated);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].timezone, 'GMT+8');
  assert.strictEqual(groups[0].members.length, 6);
  assert.strictEqual(leftover.length, 2);
});

check('people who did not opt in are never placed', () => {
  const pool = Array.from({ length: 6 }, (_, i) => who({ userId: `n${i}`, static: false }));
  const { groups, leftover } = buildStatics(pool, ungated);
  assert.strictEqual(groups.length, 0);
  assert.strictEqual(leftover.length, 0);
});

check('a static group is never larger than the content allows', () => {
  const pool = Array.from({ length: 13 }, (_, i) => who({ userId: `m${i}`, static: true }));
  const { groups } = buildStatics(pool, ungated);
  for (const g of groups) assert.ok(g.members.length <= PARTY.tank + PARTY.healer + PARTY.flex);
  assert.strictEqual(groups.length, 2);
});

// Belt and braces: the behavioural tests above prove the matcher ignores
// combat power today. This proves nobody can quietly wire it in tomorrow.
check('the matcher source never mentions combat power at all', () => {
  const fs = require('fs');
  const path = require('path');
  for (const file of ['matching.js', 'members.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', file), 'utf8');
    const code = src
      .split('\n')
      .map((l) => l.replace(/^\s*\/\/.*$/, ''))
      .join('\n'); // strip whole-line comments, where the rule is explained
    assert.ok(!/combatPower/.test(code), `${file} reads combatPower outside a comment`);
  }
});

console.log(`\n${checks} checks passed.\n`);
