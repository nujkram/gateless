// Class and timezone from a member's role NAMES.
//
// Takes names rather than a discord.js member, so the same function serves
// the gateway bot and the HTTP endpoint. The HTTP payload gives role IDs, so
// the caller maps those to names first.

const { GROUPS, archetypeForRole } = require('../config/selfroles');

const CLASS_LABELS = GROUPS.find((g) => g.id === 'class').options.map((o) => o.label);

function profileFromRoleNames(roleNames = []) {
  const className = roleNames.find((n) => CLASS_LABELS.includes(n)) ?? null;
  const tzRole = roleNames.find((n) => n.startsWith('TZ: '));
  return {
    className,
    archetype: className ? archetypeForRole(className) : null,
    timezone: tzRole ? tzRole.slice(4) : null,
  };
}

// A roster record plus its cached profile, in the shape matching.js wants.
// combatPower is deliberately not copied: the matcher cannot read what it is
// never given.
function toCandidate(record) {
  return {
    userId: record.userId,
    className: record.className ?? null,
    archetype: record.className ? archetypeForRole(record.className) : null,
    timezone: record.timezone ?? null,
    itemLevel: record.itemLevel,
    needs: record.needs ?? [],
    static: record.static ?? false,
    lastGroupedAt: record.lastGroupedAt ?? {},
  };
}

module.exports = { profileFromRoleNames, toCandidate, CLASS_LABELS };
