// Which dungeons a member still wants to run.

const roster = require('../lib/roster');
const dungeons = require('../config/dungeons');

async function toggleNeed(userId, dungeonId) {
  const dungeon = dungeons.byId(dungeonId);
  if (!dungeon) return { content: 'I do not know that dungeon.' };

  const nowNeeds = await roster.toggleNeed(userId, dungeonId);
  const record = await roster.get(userId);

  const notes = [];
  if (nowNeeds && dungeon.itemLevel != null && record.itemLevel != null && record.itemLevel < dungeon.itemLevel) {
    notes.push(
      `\nHeads up: the game gates **${dungeon.name}** at ${dungeon.itemLevel.toLocaleString()} and you have ` +
        `${record.itemLevel.toLocaleString()} recorded. You'll show up as soon as you're over it — ` +
        'nobody here is filtering you out.'
    );
  }
  if (nowNeeds && record.itemLevel == null) {
    notes.push('\nSet your item level so party suggestions can tell when you qualify.');
  }

  return { content: `${nowNeeds ? 'Added' : 'Removed'} **${dungeon.name}**.${notes.join('')}` };
}

async function listNeeds(userId) {
  const record = await roster.get(userId);
  if (!record.needs.length) {
    return { content: 'Nothing on your list. Add one with `/need toggle`.' };
  }

  const lines = record.needs
    .map((id) => dungeons.byId(id))
    .filter(Boolean)
    .map((d) => {
      const gate = d.itemLevel == null ? 'no item level recorded yet' : `${d.itemLevel.toLocaleString()} item level`;
      return `· **${d.name}** — ${gate}`;
    });

  return { content: `You still need:\n${lines.join('\n')}` };
}

module.exports = { toggleNeed, listNeeds };
