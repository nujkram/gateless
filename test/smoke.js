// Offline checks: no Discord connection, just the pure logic.
// Run with: node test/smoke.js

const assert = require('assert');
const { PermissionFlagsBits: P, ChannelType } = require('discord.js');
const { overwritesFor, resolveMentions, slug, MANAGED_ROLES } = require('../src/setup');
const { CATEGORIES } = require('../src/config/channels');
const { ROLES } = require('../src/config/roles');
const { allSelfRoles, roleNameFor, GROUPS, parseCustomId } = require('../src/config/selfroles');
const CONTENT = require('../src/config/content');

// A guild stub with just the bits overwritesFor touches.
const roleMap = new Map(MANAGED_ROLES.map((r, i) => [r.name, { id: `role${i}` }]));
const guild = {
  roles: { everyone: { id: 'everyone' } },
  members: { me: { roles: { botRole: { id: 'botrole' } } } },
};

const has = (ows, id, key, perm) =>
  ows.some((o) => o.id === id && (o[key] ?? []).includes(perm));

let checks = 0;
const check = (label, fn) => {
  fn();
  checks += 1;
  console.log(`  ok  ${label}`);
};

console.log('\nPermission presets');

check('open channels get no overwrites beyond the guest deny', () => {
  const ows = overwritesFor({ perms: 'open', guest: true }, guild, roleMap);
  assert.strictEqual(ows.length, 0);
});

check('officer-post denies @everyone and allows staff + bot', () => {
  const ows = overwritesFor({ perms: 'officer-post', guest: true }, guild, roleMap);
  assert.ok(has(ows, 'everyone', 'deny', P.SendMessages));
  assert.ok(has(ows, roleMap.get('Officer').id, 'allow', P.SendMessages));
  assert.ok(has(ows, roleMap.get('Legion Master').id, 'allow', P.SendMessages));
  assert.ok(has(ows, 'botrole', 'allow', P.SendMessages), 'bot must still post the pinned message');
  assert.ok(!has(ows, roleMap.get('Member').id, 'allow', P.SendMessages));
});

check('mentor-post lets Mentor through but not Member', () => {
  const ows = overwritesFor({ perms: 'mentor-post', guest: true }, guild, roleMap);
  assert.ok(has(ows, roleMap.get('Mentor').id, 'allow', P.SendMessages));
  assert.ok(!has(ows, roleMap.get('Member').id, 'allow', P.SendMessages));
});

check('panel channel takes no messages and no reactions', () => {
  const ows = overwritesFor({ perms: 'panel', guest: true }, guild, roleMap);
  assert.ok(has(ows, 'everyone', 'deny', P.SendMessages));
  assert.ok(has(ows, 'everyone', 'deny', P.AddReactions));
  assert.ok(has(ows, 'botrole', 'allow', P.SendMessages));
});

check('officers-only hides the channel from @everyone', () => {
  const ows = overwritesFor({ perms: 'officers-only', guest: false }, guild, roleMap);
  assert.ok(has(ows, 'everyone', 'deny', P.ViewChannel));
  assert.ok(has(ows, roleMap.get('Officer').id, 'allow', P.ViewChannel));
  assert.ok(has(ows, 'botrole', 'allow', P.ViewChannel), 'bot writes the AutoMod alerts here');
});

check('guest: false denies Guest view, guest: true does not', () => {
  const guestId = roleMap.get('Guest').id;
  assert.ok(has(overwritesFor({ perms: 'open', guest: false }, guild, roleMap), guestId, 'deny', P.ViewChannel));
  assert.ok(!has(overwritesFor({ perms: 'open', guest: true }, guild, roleMap), guestId, 'deny', P.ViewChannel));
});

console.log('\nBlueprint fidelity');

check('guests see exactly START HERE, #general, #lfg-dungeons and voice', () => {
  const visible = CATEGORIES.flatMap((c) =>
    c.channels.filter((ch) => ch.guest).map((ch) => ch.name)
  ).sort();
  assert.deepStrictEqual(visible, [
    'Hangout', 'Party 1', 'Party 2', 'Raid (10)',
    'announcements', 'charter-and-rules', 'general', 'lfg-dungeons',
    'pick-your-roles', 'welcome',
  ]);
});

check('no role name mentions CP or item level', () => {
  for (const { name } of MANAGED_ROLES) {
    assert.ok(!/\bcp\b|item ?level|\bilvl\b/i.test(name), `role "${name}" looks like a gate`);
  }
});

check('every self-role resolves to a unique role name', () => {
  const names = allSelfRoles().map((r) => r.name);
  assert.strictEqual(new Set(names).size, names.length);
  assert.strictEqual(names.length, 16);
});

check('every button customId round-trips to its role name', () => {
  for (const group of GROUPS) {
    for (const option of group.options) {
      const parsed = parseCustomId(`gl:${group.id}:${option.id}`);
      assert.ok(parsed, `${group.id}:${option.id} did not parse`);
      assert.strictEqual(roleNameFor(parsed.group, parsed.option), roleNameFor(group, option));
    }
  }
});

check('panels fit Discord limits (5 buttons/row, 5 rows/message)', () => {
  for (const group of GROUPS) {
    assert.ok(group.options.length <= 25, `${group.id} has too many buttons`);
  }
});

console.log('\nMember-list grouping');

// Discord groups a member under their highest HOISTED role. Class grouping
// only works if nothing hoisted sits above the class roles for an ordinary
// member, which is why Member and Guest are deliberately flat.
check('class roles are hoisted, content and timezone are not', () => {
  for (const r of allSelfRoles()) {
    const isClass = r.group.id === 'class';
    assert.strictEqual(r.hoist, isClass, `${r.name} hoist should be ${isClass}`);
  }
});

check('Member and Guest are not hoisted, or they swallow the class grouping', () => {
  for (const name of ['Member', 'Guest']) {
    assert.strictEqual(ROLES.find((r) => r.name === name).hoist, false, `${name} must not be hoisted`);
  }
});

check('staff roles stay hoisted so officers and mentors still stand out', () => {
  for (const name of ['Legion Master', 'Officer', 'Mentor', 'Static Lead']) {
    assert.strictEqual(ROLES.find((r) => r.name === name).hoist, true, `${name} should be hoisted`);
  }
});

check('nothing hoisted outranks the class block for an ordinary member', () => {
  const order = MANAGED_ROLES.map((r) => r.name);
  const hoisted = MANAGED_ROLES.filter((r) => r.hoist).map((r) => r.name);
  const lastStaff = order.indexOf('Static Lead');
  const firstClass = order.indexOf('Templar');
  assert.ok(lastStaff < firstClass, 'staff must rank above classes');
  const between = order.slice(lastStaff + 1, firstClass).filter((n) => hoisted.includes(n));
  assert.deepStrictEqual(between, [], `these would swallow the class grouping: ${between}`);
});

console.log('\nPinned content');

check('channel placeholders resolve to real mentions', () => {
  const channelMap = new Map([
    ['charter-and-rules', { id: '111' }],
    ['pick-your-roles', { id: '222' }],
  ]);
  const out = resolveMentions(CONTENT.welcome, channelMap);
  assert.ok(out.includes('<#111>'), 'known channel should become an ID mention');
  assert.ok(!out.includes('<#charter-and-rules>'), 'placeholder should be gone');
  assert.ok(out.includes('#introductions'), 'unknown channel degrades to plain text, not a broken mention');
});

check('every pinned text is within Discord 2000-char limit', () => {
  for (const key of ['welcome', 'charter', 'lfgTemplate', 'rolesIntro']) {
    assert.ok(CONTENT[key].length <= 2000, `${key} is ${CONTENT[key].length} chars`);
  }
});

check('text channel names slugify, voice names keep their casing', () => {
  assert.strictEqual(slug('lfg-dungeons', ChannelType.GuildText), 'lfg-dungeons');
  assert.strictEqual(slug('Raid (10)', ChannelType.GuildVoice), 'Raid (10)');
});

console.log('\nGear dialog');

check('the panel button opens the modal the bot listens for', () => {
  const { buildGearPanel } = require('../src/lib/panels');
  const { OPEN_ID } = require('../src/lib/gearmodal');
  const button = buildGearPanel().components[0].toJSON().components[0];
  assert.strictEqual(button.custom_id, OPEN_ID, 'button id must match what bot.js routes on');
});

check('modal field ids match the ids the handler reads back', () => {
  const { buildGearModal, SUBMIT_ID, FIELD_ITEM_LEVEL, FIELD_CP } = require('../src/lib/gearmodal');
  const json = buildGearModal({ itemLevel: 2500, combatPower: 150000 }).toJSON();
  assert.strictEqual(json.custom_id, SUBMIT_ID);
  const ids = json.components.map((row) => row.components[0].custom_id);
  assert.deepStrictEqual(ids, [FIELD_ITEM_LEVEL, FIELD_CP]);
});

check('the modal pre-fills what is already recorded', () => {
  const { buildGearModal } = require('../src/lib/gearmodal');
  const filled = buildGearModal({ itemLevel: 2500, combatPower: 150000 }).toJSON();
  assert.strictEqual(filled.components[0].components[0].value, '2500');
  const blank = buildGearModal({ itemLevel: null, combatPower: null }).toJSON();
  assert.ok(!blank.components[0].components[0].value, 'nothing recorded should leave the box empty');
});

check('modal stays inside Discord limits (5 rows, 45-char labels)', () => {
  const { buildGearModal } = require('../src/lib/gearmodal');
  const json = buildGearModal({}).toJSON();
  assert.ok(json.components.length <= 5);
  for (const row of json.components) {
    const field = row.components[0];
    assert.ok(field.label.length <= 45, `label too long: ${field.label}`);
    assert.ok(!field.placeholder || field.placeholder.length <= 100);
  }
});

check('numbers parse the way members actually type them', () => {
  const { parseNumber } = require('../src/lib/gearmodal');
  assert.strictEqual(parseNumber('2500').value, 2500);
  assert.strictEqual(parseNumber('2,500').value, 2500);
  assert.strictEqual(parseNumber(' 2 500 ').value, 2500);
  assert.ok(parseNumber('').empty);
  for (const bad of ['abc', '-5', '12.5', '1e4']) {
    assert.ok(parseNumber(bad).error, `${bad} should be rejected, not coerced`);
  }
});

check('the pinned intro still starts with the line setup matches on', () => {
  // upsertPinned finds its own message by first line; changing it would post
  // a duplicate instead of editing the existing pin.
  assert.strictEqual(CONTENT.rolesIntro.split(String.fromCharCode(10))[0], '# Pick your roles');
  assert.ok(CONTENT.rolesIntro.includes('/gear set'), 'intro should mention the command');
  assert.ok(CONTENT.rolesIntro.length <= 2000);
});

console.log('\nSingle-instance lock');

check('a dead pid in the lock file is taken over, not honoured', () => {
  const fs = require('fs');
  const { acquire, readLock, release, LOCK_PATH } = require('../src/lib/lock');
  fs.writeFileSync(LOCK_PATH, '999999'); // no such process
  acquire();
  assert.strictEqual(readLock(), process.pid, 'stale lock should be claimed');
  release();
  assert.strictEqual(readLock(), null, 'release should remove our own lock');
});

check('liveness check tells a running pid from a dead one', () => {
  const { isRunning } = require('../src/lib/lock');
  assert.strictEqual(isRunning(process.pid), true);
  assert.strictEqual(isRunning(999999), false);
});

console.log(`\n${checks} checks passed.\n`);
