// Party building. Pure functions — no Discord objects in or out — so the
// rules below can be tested directly.
//
// THE ONE RULE: nothing here reads combatPower. Eligibility is the game's own
// item level gate and nothing else; ordering is fairness, never strength.
// If you are changing this file, that is the invariant to keep.

const { isUngated } = require('../config/dungeons');

const ARCHETYPES = ['tank', 'healer', 'support', 'dps'];

// Splits candidates three ways instead of silently dropping anyone. Someone
// who has not recorded an item level is not "too weak" — they are unknown,
// and that difference matters when the whole charter is about not gating.
function classify(candidates, dungeon) {
  const eligible = [];
  const unverified = [];
  const underGate = [];

  for (const c of candidates) {
    if (isUngated(dungeon)) {
      eligible.push(c);
    } else if (c.itemLevel == null) {
      unverified.push(c);
    } else if (c.itemLevel >= dungeon.itemLevel) {
      eligible.push(c);
    } else {
      underGate.push(c); // the GAME stops them, not us
    }
  }
  return { eligible, unverified, underGate };
}

// Longest since we last suggested them for this dungeon comes first; someone
// never suggested comes before everyone. Ties break on userId so the result is
// deterministic and testable rather than subtly random.
function rotationOrder(dungeonId) {
  return (a, b) => {
    const at = a.lastGroupedAt?.[dungeonId] ?? '';
    const bt = b.lastGroupedAt?.[dungeonId] ?? '';
    if (at !== bt) return at < bt ? -1 : 1;
    return a.userId < b.userId ? -1 : 1;
  };
}

function take(pool, archetype, count, picked) {
  const out = [];
  for (const c of pool) {
    if (out.length >= count) break;
    if (picked.has(c.userId)) continue;
    if (archetype && c.archetype !== archetype) continue;
    out.push(c);
    picked.add(c.userId);
  }
  return out;
}

// Builds one group for a dungeon.
//
// People who said they still need the dungeon are offered first — that is the
// "dungeons they need" part. Everyone else eligible is a filler, so a run
// still forms when not enough people need it.
function buildParty(candidates, dungeon) {
  const { eligible, unverified, underGate } = classify(candidates, dungeon);
  const order = rotationOrder(dungeon.id);

  const needs = eligible.filter((c) => c.needs?.includes(dungeon.id)).sort(order);
  const fillers = eligible.filter((c) => !c.needs?.includes(dungeon.id)).sort(order);
  const pool = [...needs, ...fillers];

  const picked = new Set();
  const party = [];
  const shortfall = {};

  for (const archetype of ['tank', 'healer']) {
    const wanted = dungeon.shape[archetype] ?? 0;
    const got = take(pool, archetype, wanted, picked);
    party.push(...got);
    if (got.length < wanted) shortfall[archetype] = wanted - got.length;
  }

  // Flex seats take anyone left, in the same fairness order.
  const flexWanted = dungeon.size - party.length;
  const flex = take(pool, null, flexWanted, picked);
  party.push(...flex);
  if (party.length < dungeon.size) shortfall.any = dungeon.size - party.length;

  return {
    dungeon,
    party,
    shortfall,
    bench: pool.filter((c) => !picked.has(c.userId)),
    unverified,
    underGate,
    ungated: isUngated(dungeon),
  };
}

// Splits everyone who opted into a static into as many balanced groups as the
// roster allows. Groups are formed within a timezone where possible, because a
// static that cannot agree on a time is not a static.
function buildStatics(candidates, dungeon) {
  const wanted = candidates.filter((c) => c.static);
  const byTimezone = new Map();
  for (const c of wanted) {
    const key = c.timezone ?? 'unspecified';
    if (!byTimezone.has(key)) byTimezone.set(key, []);
    byTimezone.get(key).push(c);
  }

  const groups = [];
  const leftover = [];

  for (const [timezone, members] of byTimezone) {
    let remaining = [...members];
    while (remaining.length >= dungeon.size) {
      const built = buildParty(remaining, dungeon);
      if (built.party.length < dungeon.size) break;
      groups.push({ timezone, members: built.party, shortfall: built.shortfall });
      const used = new Set(built.party.map((m) => m.userId));
      remaining = remaining.filter((m) => !used.has(m.userId));
    }
    leftover.push(...remaining.map((m) => ({ ...m, timezone })));
  }

  return { groups, leftover };
}

// Reports what a group is short of, in words, for the message the bot posts.
//
// `any` is the total number of empty seats, and the named archetypes are a
// subset of them — so "1 tank, 1 healer, 5 more people" reads as though it
// wants seven. Phrase it as a total with the roles nested inside.
function describeShortfall(shortfall) {
  const { any, ...roles } = shortfall;
  const named = Object.entries(roles).map(([what, n]) => `${n} ${what}${n === 1 ? '' : 's'}`);

  if (any == null) return named.join(', ');
  const people = `${any} more ${any === 1 ? 'person' : 'people'}`;
  return named.length ? `${people} (including ${named.join(' and ')})` : people;
}

module.exports = { classify, buildParty, buildStatics, rotationOrder, describeShortfall, ARCHETYPES };
