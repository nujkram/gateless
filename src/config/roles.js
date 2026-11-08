// Staff and membership roles, highest rank first.
// Roles describe what people DO, never how strong they are — there are no CP
// or item-level bracket roles anywhere in this file, by charter rule 1.

const { PermissionFlagsBits: P } = require('discord.js');

const ROLES = [
  {
    name: 'Legion Master',
    color: 0xE8B64C,
    hoist: true,
    mentionable: true,
    permissions: [P.Administrator],
  },
  {
    name: 'Officer',
    color: 0xD9734E,
    hoist: true,
    mentionable: true,
    permissions: [
      P.ManageMessages,
      P.ManageThreads,
      P.KickMembers,
      P.ModerateMembers,
      P.MuteMembers,
      P.MoveMembers,
      P.ManageEvents,
    ],
  },
  {
    name: 'Mentor',
    color: 0x4EA1D9,
    hoist: true,
    mentionable: true,
    permissions: [],
  },
  {
    name: 'Static Lead',
    color: 0x7E6BD9,
    hoist: true,
    mentionable: true,
    permissions: [],
  },
  // Member and Guest are deliberately NOT hoisted. Discord groups someone in
  // the member list under their highest *hoisted* role, and these two sit
  // above the class roles — hoisting them would swallow the class grouping and
  // file the whole legion under one "Member" heading. Staff roles above stay
  // hoisted, so officers and mentors still stand out.
  {
    name: 'Member',
    color: 0x5FB58A,
    hoist: false,
    mentionable: true,
    permissions: [],
  },
  {
    name: 'Guest',
    color: 0x8A8F98,
    hoist: false,
    mentionable: false,
    permissions: [],
  },
];

// Convenience lookups used by the channel permission presets.
const STAFF = ['Legion Master', 'Officer'];
const MENTOR_PLUS = ['Legion Master', 'Officer', 'Mentor'];

module.exports = { ROLES, STAFF, MENTOR_PLUS };
