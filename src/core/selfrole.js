// What a self-role button click should change.
//
// Pure: given the group, the option and the role names the member already
// has, work out what to add and remove and what to tell them. The transport
// resolves names to IDs and performs the change.

const { GROUPS, roleNameFor } = require('../config/selfroles');

function planSelfRole(groupId, optionId, currentRoleNames = []) {
  const group = GROUPS.find((g) => g.id === groupId);
  const option = group?.options.find((o) => o.id === optionId);
  if (!group || !option) return null;

  const wanted = roleNameFor(group, option);
  const has = currentRoleNames.includes(wanted);

  // Clicking what you already have always removes it, in every group.
  if (has) {
    return { add: [], remove: [wanted], content: `Removed **${option.label}**.` };
  }

  if (!group.exclusive) {
    return { add: [wanted], remove: [], content: `Added **${option.label}**.` };
  }

  // Exclusive group: drop the other options in this group first.
  const siblings = group.options
    .filter((o) => o.id !== option.id)
    .map((o) => roleNameFor(group, o))
    .filter((name) => currentRoleNames.includes(name));

  const replaced = siblings.length ? ` (replaced ${siblings.join(', ')})` : '';
  return {
    add: [wanted],
    remove: siblings,
    content: `You are now **${option.label}**${replaced}.`,
  };
}

module.exports = { planSelfRole };
