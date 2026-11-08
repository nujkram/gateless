// Self-assigned roles, posted as button panels in #pick-your-roles.
//
// Three groups:
//   class    — exclusive: picking a new one replaces the old
//   content  — multi-select: toggle each on or off
//   timezone — exclusive
//
// None of these grant permissions. They exist so LFG posts can ping the
// Clerics or the Ludra crowd without anyone having to read a CP number.

const { ButtonStyle } = require('discord.js');

const GROUPS = [
  {
    id: 'class',
    exclusive: true,
    title: 'Pick your class',
    blurb:
      'Click your main class. Choosing a new class replaces your old one.\n' +
      'Click your current class again to remove it.',
    color: 0xD9734E,
    options: [
      { id: 'templar',      label: 'Templar',      style: ButtonStyle.Primary,   emoji: '🛡️', archetype: 'tank' },
      { id: 'gladiator',    label: 'Gladiator',    style: ButtonStyle.Danger,    emoji: '⚔️', archetype: 'dps' },
      { id: 'assassin',     label: 'Assassin',     style: ButtonStyle.Secondary, emoji: '🗡️', archetype: 'dps' },
      { id: 'ranger',       label: 'Ranger',       style: ButtonStyle.Secondary, emoji: '🏹', archetype: 'dps' },
      { id: 'sorcerer',     label: 'Sorcerer',     style: ButtonStyle.Primary,   emoji: '🔮', archetype: 'dps' },
      { id: 'spiritmaster', label: 'Spiritmaster', style: ButtonStyle.Primary,   emoji: '👻', archetype: 'dps' },
      { id: 'cleric',       label: 'Cleric',       style: ButtonStyle.Success,   emoji: '✨', archetype: 'healer' },
      { id: 'chanter',      label: 'Chanter',      style: ButtonStyle.Success,   emoji: '🎶', archetype: 'support' },
      { id: 'brawler',      label: 'Brawler',      style: ButtonStyle.Danger,    emoji: '🥊', archetype: 'dps' },
    ],
  },
  {
    id: 'content',
    exclusive: false,
    title: 'What do you run?',
    blurb: 'Pick as many as you like. These are the pings LFG posts use.',
    color: 0x4EA1D9,
    options: [
      { id: 'dungeons', label: 'Dungeons',  style: ButtonStyle.Secondary, emoji: '🏰' },
      { id: 'ludra',    label: 'Ludra',     style: ButtonStyle.Secondary, emoji: '🐉' },
      { id: 'abyss',    label: 'Abyss PvP', style: ButtonStyle.Secondary, emoji: '🗡️' },
      { id: 'casual',   label: 'Casual',    style: ButtonStyle.Secondary, emoji: '🌙' },
    ],
  },
  {
    id: 'timezone',
    exclusive: true,
    title: 'When are you on?',
    blurb: 'Legion times are posted in GMT+8 (Philippines) by default.',
    color: 0x5FB58A,
    options: [
      { id: 'gmt8',       label: 'GMT+8',      style: ButtonStyle.Secondary, emoji: '🇵🇭' },
      { id: 'other-asia', label: 'Other Asia', style: ButtonStyle.Secondary, emoji: '🌏' },
      { id: 'other',      label: 'Other',      style: ButtonStyle.Secondary, emoji: '🌍' },
    ],
  },
];

// customId format: gl:<groupId>:<optionId>
const PREFIX = 'gl:';
const customId = (groupId, optionId) => `${PREFIX}${groupId}:${optionId}`;
const parseCustomId = (raw) => {
  if (!raw.startsWith(PREFIX)) return null;
  const [groupId, optionId] = raw.slice(PREFIX.length).split(':');
  const group = GROUPS.find((g) => g.id === groupId);
  const option = group?.options.find((o) => o.id === optionId);
  return group && option ? { group, option } : null;
};

// The Discord role name for a self-role option. Class roles keep their bare
// label ("Cleric") so LFG pings read naturally; the other groups get a prefix
// so "Casual" and "Other" can't collide with anything else on the server.
function roleNameFor(group, option) {
  if (group.id === 'class') return option.label;
  if (group.id === 'content') return `Runs: ${option.label}`;
  return `TZ: ${option.label}`;
}

// Every self-role the setup script needs to create, flattened.
//
// Only the class roles are hoisted: hoisting is what makes Discord group
// members under a heading in the right-hand member list, and class is the
// grouping that is actually useful at a glance. Content and timezone roles
// stay unhoisted — sixteen headings would be unreadable, and a member can
// only ever be grouped under one of them anyway.
function allSelfRoles() {
  return GROUPS.flatMap((group) =>
    group.options.map((option) => ({
      name: roleNameFor(group, option),
      color: group.color,
      hoist: group.id === 'class',
      mentionable: true,
      permissions: [],
      group,
      option,
    }))
  );
}

// Archetype for a class role name, used only to balance a party's shape
// (one tank, one healer, the rest flexible) — never to rank anyone.
function archetypeForRole(roleName) {
  const cls = GROUPS.find((g) => g.id === 'class').options.find((o) => o.label === roleName);
  return cls?.archetype ?? null;
}

const CLASSES = GROUPS.find((g) => g.id === 'class').options;

module.exports = {
  GROUPS,
  CLASSES,
  PREFIX,
  customId,
  parseCustomId,
  roleNameFor,
  allSelfRoles,
  archetypeForRole,
};
