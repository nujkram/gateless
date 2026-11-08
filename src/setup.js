// One-shot, idempotent server bootstrap for Gateless.
//
//   npm run setup        build / repair the server
//   npm run setup:dry    report what it would change, touch nothing
//
// Safe to run again after editing any file in src/config: existing roles,
// channels and pinned messages are updated in place, never duplicated.

const {
  ChannelType,
  PermissionFlagsBits: P,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  AutoModerationActionType,
} = require('discord.js');

const { ROLES, STAFF, MENTOR_PLUS } = require('./config/roles');
const { CATEGORIES, PINNED, THREADED_CHANNEL, MOD_LOG, LFG_CHANNELS } = require('./config/channels');
const { GROUPS, allSelfRoles } = require('./config/selfroles');
const CONTENT = require('./config/content');
const AUTOMOD = require('./config/automod');
const { connect, checkPermissions, log, section, summary } = require('./lib/client');
const { buildPanel, buildGearPanel } = require('./lib/panels');

const DRY = process.argv.includes('--dry-run');

// discord.js 14.22 replaced the single `color` option with a `colors` object
// (roles can be gradients now). package.json requires a version that has it.
const colorPayload = (hex) => (hex == null ? {} : { colors: { primaryColor: hex } });
const currentColor = (role) => role.colors?.primaryColor ?? role.color;

// Every role this project owns, in the order they should sit in the sidebar.
const MANAGED_ROLES = [...ROLES, ...allSelfRoles()];

// ── roles ──────────────────────────────────────────────────────────────────

// Discord refuses to let a bot grant a permission it does not hold itself.
// Rather than dying on "Legion Master" (Administrator), create the role
// without permissions and say exactly what to tick by hand.
async function createRole(guild, spec) {
  const base = { name: spec.name, ...colorPayload(spec.color), hoist: spec.hoist, mentionable: spec.mentionable };
  try {
    return await guild.roles.create({ ...base, permissions: spec.permissions });
  } catch (err) {
    if (err.code !== 50013 || !spec.permissions.length) throw err;
    const role = await guild.roles.create({ ...base, permissions: [] });
    const names = Object.entries(P)
      .filter(([, bit]) => spec.permissions.includes(bit))
      .map(([name]) => name)
      .join(', ');
    log('warn', spec.name, `created without permissions (${names}) - the bot cannot grant what it does not have. Tick them by hand, or re-invite the bot with Administrator and re-run.`);
    return role;
  }
}

async function ensureRoles(guild) {
  section('Roles');
  const map = new Map();

  for (const spec of MANAGED_ROLES) {
    const existing = guild.roles.cache.find((r) => r.name === spec.name && !r.managed);
    if (existing) {
      map.set(spec.name, existing);
      const needsHoist = existing.hoist !== spec.hoist;
      const needsColor = spec.color != null && currentColor(existing) !== spec.color;
      if ((needsHoist || needsColor) && !DRY) {
        await existing.edit({ hoist: spec.hoist, ...colorPayload(spec.color) });
        const what = needsHoist ? (spec.hoist ? 'now shown separately in the member list' : 'no longer shown separately') : 'colour updated';
        log('edit', spec.name, what);
      } else if (needsHoist || needsColor) {
        log('edit', spec.name, 'would update appearance');
      } else {
        log('same', spec.name);
      }
      continue;
    }
    if (DRY) {
      log('add', spec.name, 'would create');
      continue;
    }
    try {
      const role = await createRole(guild, spec);
      map.set(spec.name, role);
      log('add', spec.name);
    } catch (err) {
      log('fail', spec.name, err.message);
    }
  }
  return map;
}

// Puts our roles in blueprint order, all of them below the bot's own role so
// the bot can keep assigning them.
async function orderRoles(guild, roleMap) {
  if (DRY) return;
  section('Role order');
  await guild.roles.fetch();
  const botTop = guild.members.me.roles.highest;
  const ordered = MANAGED_ROLES.map((s) => roleMap.get(s.name)).filter(Boolean);

  // Creating roles one by one already stacks them in the right order, because
  // each new role lands at the bottom and pushes the previous ones up. So
  // check before touching anything — a fresh server needs no reorder at all,
  // and asking for one returns Missing Permissions often enough to look like
  // a real failure when it isn't.
  const actual = [...ordered].sort((a, b) => b.position - a.position);
  if (actual.every((role, i) => role.id === ordered[i].id)) {
    log('same', 'hierarchy', `${ordered.length} roles already in order`);
    return;
  }

  const top = botTop.position - 1;
  if (top < ordered.length) {
    log('warn', 'hierarchy', `the bot role "${botTop.name}" sits at position ${botTop.position}, too low to fit ${ordered.length} roles beneath it. Drag it to just under Legion Master in Server Settings > Roles, then re-run.`);
    return;
  }

  try {
    await guild.roles.setPositions(ordered.map((role, i) => ({ role, position: top - i })));
    log('edit', 'hierarchy', `${ordered.length} roles ordered beneath "${botTop.name}"`);
  } catch (err) {
    log('warn', 'hierarchy', `could not reorder roles (${err.message}). Roles still work; this only affects the order they appear in Server Settings > Roles. Drag the bot role "${botTop.name}" to the top and re-run if you want it tidy.`);
  }
}

// ── channels ───────────────────────────────────────────────────────────────

const POST = [P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads];
const POST_DENY = [...POST, P.CreatePrivateThreads];

function overwritesFor(spec, guild, roleMap) {
  const everyone = guild.roles.everyone.id;
  const botRole = guild.members.me.roles.botRole;
  const ids = (names) => names.map((n) => roleMap.get(n)?.id).filter(Boolean);
  const out = [];

  const letPost = (names) => {
    out.push({ id: everyone, deny: POST_DENY });
    for (const id of ids(names)) out.push({ id, allow: POST });
    if (botRole) out.push({ id: botRole.id, allow: POST });
  };

  switch (spec.perms) {
    case 'officer-post':
      letPost(STAFF);
      break;
    case 'mentor-post':
      letPost(MENTOR_PLUS);
      break;
    case 'panel':
      out.push({ id: everyone, deny: [...POST_DENY, P.AddReactions] });
      if (botRole) out.push({ id: botRole.id, allow: POST });
      for (const id of ids(STAFF)) out.push({ id, allow: POST });
      break;
    case 'officers-only':
      out.push({ id: everyone, deny: [P.ViewChannel] });
      for (const id of ids(STAFF)) {
        out.push({ id, allow: [P.ViewChannel, P.ReadMessageHistory, ...POST] });
      }
      if (botRole) out.push({ id: botRole.id, allow: [P.ViewChannel, P.ReadMessageHistory, ...POST] });
      break;
    case 'open':
    default:
      break;
  }

  // Guests see START HERE, #general, #lfg-dungeons and voice. Nothing else.
  if (!spec.guest) {
    const guest = roleMap.get('Guest');
    if (guest) out.push({ id: guest.id, deny: [P.ViewChannel] });
  }
  return out;
}

// Discord slugifies text channel names; voice channels keep their casing.
const slug = (name, type) =>
  type === ChannelType.GuildText ? name.toLowerCase().replace(/\s+/g, '-') : name;

async function ensureChannels(guild, roleMap) {
  section('Channels');
  await guild.channels.fetch();
  const map = new Map();

  for (const category of CATEGORIES) {
    let parent = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === category.name
    );
    if (!parent) {
      if (DRY) {
        log('add', category.name, 'would create category');
      } else {
        parent = await guild.channels.create({ name: category.name, type: ChannelType.GuildCategory });
        log('add', category.name, 'category');
      }
    } else {
      log('same', category.name, 'category');
    }

    for (const spec of category.channels) {
      const type = spec.type ?? ChannelType.GuildText;
      const wanted = slug(spec.name, type);
      const existing = guild.channels.cache.find((c) => c.type === type && c.name === wanted);

      if (existing) {
        map.set(spec.name, existing);
        if (DRY) {
          log('same', `#${spec.name}`);
          continue;
        }
        try {
          await existing.edit({
            parent: parent?.id ?? existing.parentId,
            topic: type === ChannelType.GuildText ? spec.topic : undefined,
            permissionOverwrites: overwritesFor(spec, guild, roleMap),
          });
          log('edit', `#${spec.name}`, 'permissions synced');
        } catch (err) {
          log('fail', `#${spec.name}`, err.message);
        }
        continue;
      }

      if (DRY) {
        log('add', `#${spec.name}`, 'would create');
        continue;
      }
      try {
        const channel = await guild.channels.create({
          name: spec.name,
          type,
          parent: parent?.id,
          topic: type === ChannelType.GuildText ? spec.topic : undefined,
          userLimit: spec.userLimit,
          permissionOverwrites: overwritesFor(spec, guild, roleMap),
        });
        map.set(spec.name, channel);
        log('add', `#${spec.name}`);
      } catch (err) {
        log('fail', `#${spec.name}`, err.message);
      }
    }
  }
  return map;
}

// ── pinned posts ───────────────────────────────────────────────────────────

// content.js writes channel links as <#channel-name>; swap in the real IDs.
function resolveMentions(text, channelMap) {
  return text.replace(/<#([a-z0-9-]+)>/g, (whole, name) => {
    const channel = channelMap.get(name);
    return channel ? `<#${channel.id}>` : `#${name}`;
  });
}

// Matches on the first line so edits to the body do not orphan the old message.
async function upsertPinned(channel, body) {
  const firstLine = body.split('\n')[0];
  const recent = await channel.messages.fetch({ limit: 50 });
  const mine = recent.find(
    (m) => m.author.id === channel.client.user.id && m.content.startsWith(firstLine)
  );

  if (mine) {
    if (mine.content !== body) {
      await mine.edit(body);
      if (!mine.pinned) await mine.pin();
      return 'edit';
    }
    if (!mine.pinned) await mine.pin();
    return 'same';
  }

  const sent = await channel.send(body);
  await sent.pin();
  return 'add';
}

async function ensurePosts(guild, channelMap) {
  section('Pinned posts');
  for (const [channelName, contentKey] of Object.entries(PINNED)) {
    const channel = channelMap.get(channelName);
    if (!channel) {
      log('warn', `#${channelName}`, 'channel missing - skipped');
      continue;
    }
    if (DRY) {
      log('same', `#${channelName}`, `would pin ${contentKey}`);
      continue;
    }
    try {
      const body = resolveMentions(CONTENT[contentKey], channelMap);
      log(await upsertPinned(channel, body), `#${channelName}`, contentKey);
    } catch (err) {
      log('fail', `#${channelName}`, err.message);
    }
  }
}

// ── self-role panels ───────────────────────────────────────────────────────

async function ensurePanels(guild, channelMap) {
  section('Role panels');
  const channel = channelMap.get('pick-your-roles');
  if (!channel) return log('warn', '#pick-your-roles', 'channel missing - skipped');
  if (DRY) return log('same', '#pick-your-roles', `would post ${GROUPS.length} panels`);

  try {
    log(await upsertPinned(channel, CONTENT.rolesIntro), '#pick-your-roles', 'intro');

    const recent = await channel.messages.fetch({ limit: 50 });
    for (const group of GROUPS) {
      const marker = `gl:${group.id}:`;
      const mine = recent.find(
        (m) =>
          m.author.id === guild.client.user.id &&
          m.components.some((row) => row.components.some((c) => c.customId?.startsWith(marker)))
      );
      const payload = buildPanel(group);
      if (mine) {
        await mine.edit(payload);
        log('edit', `panel: ${group.id}`);
      } else {
        await channel.send(payload);
        log('add', `panel: ${group.id}`);
      }
    }

    // The gear panel: one button that opens a dialog, so nobody has to know
    // the slash command exists.
    const gearPanel = recent.find(
      (m) =>
        m.author.id === guild.client.user.id &&
        m.components.some((row) => row.components.some((c) => c.customId?.startsWith('gl:gear:')))
    );
    if (gearPanel) {
      await gearPanel.edit(buildGearPanel());
      log('edit', 'panel: gear');
    } else {
      await channel.send(buildGearPanel());
      log('add', 'panel: gear');
    }
  } catch (err) {
    log('fail', '#pick-your-roles', err.message);
  }
}

// ── one thread per class ───────────────────────────────────────────────────

async function ensureClassThreads(guild, channelMap) {
  section('Class threads');
  const channel = channelMap.get(THREADED_CHANNEL);
  if (!channel || channel.type !== ChannelType.GuildText) {
    return log('warn', `#${THREADED_CHANNEL}`, 'channel missing - skipped');
  }
  const classes = GROUPS.find((g) => g.id === 'class').options;
  if (DRY) return log('same', `#${THREADED_CHANNEL}`, `would open ${classes.length} threads`);

  let active;
  try {
    active = await channel.threads.fetchActive();
  } catch (err) {
    return log('fail', `#${THREADED_CHANNEL}`, err.message);
  }

  for (const cls of classes) {
    if (active.threads.some((t) => t.name === cls.label)) {
      log('same', `thread: ${cls.label}`);
      continue;
    }
    try {
      await channel.threads.create({
        name: cls.label,
        autoArchiveDuration: 10080, // one week
        reason: 'Gateless class thread',
      });
      log('add', `thread: ${cls.label}`);
    } catch (err) {
      log('fail', `thread: ${cls.label}`, err.message);
    }
  }
}

// ── AutoMod ────────────────────────────────────────────────────────────────

async function ensureAutomod(guild, channelMap) {
  section('AutoMod');
  const modLog = channelMap.get(MOD_LOG);
  if (!modLog) return log('warn', AUTOMOD.RULE_NAME, `#${MOD_LOG} missing - skipped`);

  // AutoMod rules are server-wide; the only scoping tool is an exempt list.
  // Exempt everything except the two LFG channels so #gear-help stays usable,
  // where talking about CP is the entire point of the channel.
  const watched = LFG_CHANNELS.map((n) => channelMap.get(n)?.id).filter(Boolean);
  if (!watched.length) return log('warn', AUTOMOD.RULE_NAME, 'no LFG channels found - skipped');

  const allExempt = guild.channels.cache
    .filter((c) => c.isTextBased() && !watched.includes(c.id))
    .map((c) => c.id);
  const exempt = [...allExempt.values()].slice(0, 50);

  // Discord caps the exempt list at 50. Past that the rule would start firing
  // in channels it was never meant to watch, so say so loudly rather than
  // quietly flagging people in #gear-help.
  if (allExempt.size > 50) {
    log('warn', AUTOMOD.RULE_NAME, `${allExempt.size} channels need exempting but Discord allows 50. ${allExempt.size - 50} channel(s) will be watched by mistake - narrow the keyword list or drop a category.`);
  }

  const actions = [
    { type: AutoModerationActionType.SendAlertMessage, metadata: { channel: modLog.id } },
  ];
  if (AUTOMOD.BLOCK) {
    actions.unshift({
      type: AutoModerationActionType.BlockMessage,
      metadata: { customMessage: AUTOMOD.CUSTOM_MESSAGE },
    });
  }

  const options = {
    name: AUTOMOD.RULE_NAME,
    eventType: AutoModerationRuleEventType.MessageSend,
    triggerType: AutoModerationRuleTriggerType.Keyword,
    triggerMetadata: { keywordFilter: AUTOMOD.KEYWORDS, allowList: AUTOMOD.ALLOW_LIST },
    actions,
    enabled: true,
    exemptChannels: exempt,
    reason: 'Charter rule 1: item level is the only gate',
  };

  if (DRY) {
    return log('same', AUTOMOD.RULE_NAME, `would watch ${watched.length} channels, exempt ${exempt.length}`);
  }

  try {
    const rules = await guild.autoModerationRules.fetch();
    const existing = rules.find((r) => r.name === AUTOMOD.RULE_NAME);
    if (existing) {
      await existing.edit(options);
      log('edit', AUTOMOD.RULE_NAME, `watching ${watched.length} channels`);
    } else {
      await guild.autoModerationRules.create(options);
      log('add', AUTOMOD.RULE_NAME, `watching ${watched.length} channels, alerting #${MOD_LOG}`);
    }
  } catch (err) {
    log('fail', AUTOMOD.RULE_NAME, err.message);
  }
}

// ── run ────────────────────────────────────────────────────────────────────

async function main() {
  const { client, guild } = await connect();
  console.log(`\nGateless setup - ${guild.name}${DRY ? '  (dry run: nothing will change)' : ''}`);

  const { missing, botRole } = checkPermissions(guild);
  if (missing.length) {
    console.warn(`\n! The bot is missing: ${missing.join(', ')}`);
    console.warn('  Some steps below will fail. Re-invite it with the link in the README.');
  }
  console.log(`  Bot role: "${botRole.name}" at position ${botRole.position}`);

  const roleMap = await ensureRoles(guild);
  await orderRoles(guild, roleMap);
  const channelMap = await ensureChannels(guild, roleMap);
  await ensurePosts(guild, channelMap);
  await ensurePanels(guild, channelMap);
  await ensureClassThreads(guild, channelMap);
  await ensureAutomod(guild, channelMap);

  summary();
  if (!DRY) {
    console.log('\nNext: run `npm start` so the role buttons in #pick-your-roles respond.');
  }
  await client.destroy();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { overwritesFor, resolveMentions, slug, MANAGED_ROLES };

