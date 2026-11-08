// Party and static suggestions, as ready-to-send message payloads.
//
// Candidates come from the roster's cached class and timezone rather than a
// REST lookup per member. That matters on Vercel: Discord closes an
// interaction after 3 seconds, and fetching twenty members one at a time
// would never make it.

const { EmbedBuilder } = require('discord.js');
const roster = require('../lib/roster');
const { toCandidate } = require('./profile');
const { buildParty, buildStatics, describeShortfall } = require('../lib/matching');

async function candidates() {
  return (await roster.all()).map(toCandidate);
}

const line = (c) => {
  const il = c.itemLevel == null ? 'item level not set' : `ilvl ${c.itemLevel.toLocaleString()}`;
  return `<@${c.userId}> — ${c.className ?? 'no class picked'}, ${il}`;
};

async function lfgPayload(dungeon) {
  const pool = await candidates();
  if (!pool.length) {
    return {
      content:
        'Nobody has recorded any gear yet, so I have nobody to suggest. ' +
        'Ask people to set their item level in #pick-your-roles, then `/need toggle`.',
      markIds: [],
    };
  }

  const result = buildParty(pool, dungeon);

  const embed = new EmbedBuilder()
    .setTitle(`${dungeon.name} — suggested group`)
    .setColor(result.party.length >= dungeon.size ? 0x5fb58a : 0xd9734e)
    .setDescription(
      result.ungated
        ? '_No item level recorded for this content yet, so everyone on the roster is in the running._'
        : `Game requirement: **${dungeon.itemLevel.toLocaleString()}** item level. That is the only filter applied.`
    );

  embed.addFields(
    result.party.length
      ? { name: `Party (${result.party.length}/${dungeon.size})`, value: result.party.map(line).join('\n') }
      : { name: 'Party', value: '_nobody eligible yet_' }
  );

  if (Object.keys(result.shortfall).length) {
    embed.addFields({ name: 'Still short', value: describeShortfall(result.shortfall) });
  }
  if (result.bench.length) {
    embed.addFields({
      name: 'Next up',
      value: result.bench.slice(0, 5).map((c) => `<@${c.userId}>`).join(', '),
    });
  }

  const notes = [];
  if (result.unverified.length) {
    notes.push(
      `${result.unverified.length} member(s) have no item level recorded, so I can't tell if they qualify. ` +
        'They are not excluded.'
    );
  }
  if (result.underGate.length) {
    notes.push(`${result.underGate.length} member(s) are under the game's own requirement for this content.`);
  }
  if (notes.length) embed.addFields({ name: 'Notes', value: notes.join('\n') });

  embed.setFooter({
    text: 'Ordered by who has waited longest, not by power. Combat power is not read by this command.',
  });

  return { embeds: [embed.toJSON()], markIds: result.party.map((c) => c.userId) };
}

async function staticsPayload(dungeon) {
  const pool = await candidates();
  const { groups, leftover } = buildStatics(pool, dungeon);

  if (!groups.length && !leftover.length) {
    return { content: 'Nobody has opted into a static yet. Point people at `/static join`.' };
  }

  const embed = new EmbedBuilder()
    .setTitle(`Proposed statics — ${dungeon.name}`)
    .setColor(0x7e6bd9)
    .setDescription(
      groups.length
        ? `${groups.length} full group(s) of ${dungeon.size}, grouped by timezone.`
        : 'Not enough people in any one timezone to fill a group yet.'
    );

  groups.slice(0, 10).forEach((group, i) => {
    embed.addFields({
      name: `Group ${i + 1} — ${group.timezone}`,
      value: group.members.map((m) => `<@${m.userId}> — ${m.className ?? 'no class'}`).join('\n'),
    });
  });

  if (leftover.length) {
    embed.addFields({
      name: `Not placed (${leftover.length})`,
      value:
        leftover.slice(0, 15).map((m) => `<@${m.userId}> — ${m.timezone ?? 'no timezone'}`).join('\n') +
        (leftover.length > 15 ? `\n…and ${leftover.length - 15} more` : ''),
    });
  }

  embed.setFooter({
    text: 'Grouped by timezone and class balance. Combat power is not read by this command.',
  });

  return { embeds: [embed.toJSON()] };
}

async function setStatic(userId, wants) {
  await roster.setStatic(userId, wants);
  const record = await roster.get(userId);
  const nudge =
    wants && record.itemLevel == null
      ? '\nSet your item level so I can place you in the right content.'
      : '';
  return {
    content: wants ? `You're in the pool for a static.${nudge}` : "You're out of the static pool.",
  };
}

module.exports = { lfgPayload, staticsPayload, setStatic, candidates };
