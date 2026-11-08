// Turns a Discord member plus their roster record into the plain object the
// matching code works with.
//
// Class and timezone are read live from roles rather than stored, so the
// buttons in #pick-your-roles stay the single source of truth for both.

const { archetypeForRole, GROUPS } = require('../config/selfroles');
const roster = require('./roster');

const CLASS_LABELS = GROUPS.find((g) => g.id === 'class').options.map((o) => o.label);

function classOf(member) {
  const role = member.roles.cache.find((r) => CLASS_LABELS.includes(r.name));
  return role ? { name: role.name, archetype: archetypeForRole(role.name) } : null;
}

function timezoneOf(member) {
  const role = member.roles.cache.find((r) => r.name.startsWith('TZ: '));
  return role ? role.name.slice(4) : null;
}

function toCandidate(member, record) {
  const cls = classOf(member);
  return {
    userId: member.id,
    displayName: member.displayName,
    className: cls?.name ?? null,
    archetype: cls?.archetype ?? null,
    timezone: timezoneOf(member),
    itemLevel: record.itemLevel,
    needs: record.needs ?? [],
    static: record.static ?? false,
    lastGroupedAt: record.lastGroupedAt ?? {},
    // combatPower is deliberately NOT carried into candidates. The matching
    // code cannot read what it is never given.
  };
}

// Everyone on the roster, resolved against the guild.
//
// Fetches members one at a time over REST rather than guild.members.fetch(),
// which would need the privileged GUILD_MEMBERS intent switched on in the
// Developer Portal. The roster is opt-in anyway: you are in it once you have
// run /gear set.
async function roll(guild) {
  const records = roster.all();
  const candidates = [];
  for (const record of records) {
    try {
      const member = await guild.members.fetch(record.userId);
      candidates.push(toCandidate(member, record));
    } catch {
      // Left the server — skip, but leave their row alone in case they return.
    }
  }
  return candidates;
}

module.exports = { toCandidate, roll, classOf, timezoneOf, CLASS_LABELS };
