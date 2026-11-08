// Routes a raw Discord interaction payload to a response payload.
//
// This is the HTTP equivalent of client.on(InteractionCreate) in bot.js. It
// takes plain JSON and returns plain JSON, so it can be tested without a
// network, a token or a Discord client.
//
// Discord closes an interaction after 3 seconds. Every path here is one or
// two REST calls plus one storage round trip, which fits comfortably. If a
// path ever grows past that, the fix is to answer DEFERRED (type 5) and
// follow up with rest.editReply.

const dungeons = require('../config/dungeons');
const roster = require('../lib/roster');
const rest = require('../lib/rest');
const { GROUPS, parseCustomId } = require('../config/selfroles');
const { buildPanel, buildGearPanel } = require('../lib/panels');
const { buildGearModal, OPEN_ID, SUBMIT_ID, FIELD_ITEM_LEVEL, FIELD_CP } = require('../lib/gearmodal');
const { profileFromRoleNames } = require('../core/profile');
const { planSelfRole } = require('../core/selfrole');
const gear = require('../core/gear');
const needs = require('../core/needs');
const party = require('../core/party');

const Type = { Ping: 1, Command: 2, Component: 3, ModalSubmit: 5 };
const Reply = { Pong: 1, Message: 4, Deferred: 5, Modal: 9 };
const EPHEMERAL = 64;

const ephemeral = (payload) => ({
  type: Reply.Message,
  data: { ...(typeof payload === 'string' ? { content: payload } : payload), flags: EPHEMERAL },
});
const publicMessage = (payload) => ({ type: Reply.Message, data: payload });

// ── reading the payload ────────────────────────────────────────────────────

// Flattens a command's options, stepping into a subcommand if there is one.
function readOptions(data) {
  let options = data.options ?? [];
  let sub = null;
  if (options.length && options[0].type === 1) {
    sub = options[0].name;
    options = options[0].options ?? [];
  }
  const byName = new Map(options.map((o) => [o.name, o.value]));
  return { sub, get: (name) => (byName.has(name) ? byName.get(name) : null) };
}

const modalFields = (data) =>
  new Map(
    (data.components ?? []).flatMap((row) =>
      (row.components ?? []).map((c) => [c.custom_id, c.value ?? ''])
    )
  );

const MANAGE_GUILD = 1n << 5n;
const hasManageGuild = (member) => {
  try {
    return (BigInt(member?.permissions ?? '0') & MANAGE_GUILD) === MANAGE_GUILD;
  } catch {
    return false;
  }
};

// ── handlers ───────────────────────────────────────────────────────────────

async function runCommand(body, ctx) {
  const { sub, get } = readOptions(body.data);

  switch (body.data.name) {
    case 'gear': {
      if (sub === 'set') {
        const itemLevel = get('itemlevel');
        const cp = get('cp');
        if (itemLevel == null && cp == null) {
          return ephemeral('Give me at least one of **itemlevel** or **cp**.');
        }
        return ephemeral(await gear.saveGear(ctx.userId, { itemLevel, combatPower: cp }));
      }

      const targetId = get('member') ?? ctx.userId;
      const isSelf = targetId === ctx.userId;
      const record = await roster.get(targetId);

      let displayName = 'That member';
      let className = null;
      if (isSelf) {
        displayName = ctx.displayName;
        className = ctx.profile.className;
      } else {
        try {
          const member = await rest.getMember(ctx.guildId, targetId);
          displayName = member.nick || member.user?.global_name || member.user?.username || displayName;
          const names = member.roles.map((id) => ctx.roleNames.get(id)).filter(Boolean);
          className = profileFromRoleNames(names).className;
        } catch {
          /* not in the guild any more — fall back to whatever is on record */
        }
      }
      return ephemeral(gear.gearView({ record, isSelf, displayName, className }));
    }

    case 'need':
      return ephemeral(
        sub === 'list'
          ? await needs.listNeeds(ctx.userId)
          : await needs.toggleNeed(ctx.userId, get('dungeon'))
      );

    case 'lfg': {
      const dungeon = dungeons.byId(get('dungeon'));
      if (!dungeon) return ephemeral('I do not know that dungeon.');
      const { markIds, ...payload } = await party.lfgPayload(dungeon);
      if (markIds?.length) await roster.markGrouped(markIds, dungeon.id);
      return get('private') ? ephemeral(payload) : publicMessage(payload);
    }

    case 'static': {
      if (sub === 'join' || sub === 'leave') {
        return ephemeral(await party.setStatic(ctx.userId, sub === 'join'));
      }
      const allowed =
        hasManageGuild(body.member) ||
        ctx.roleNameList.some((n) => ['Static Lead', 'Officer', 'Legion Master'].includes(n));
      if (!allowed) {
        return ephemeral(
          'Proposing static rosters is for Static Leads and Officers. You can still `/static join`.'
        );
      }
      const dungeon = dungeons.byId(get('content'));
      if (!dungeon) return ephemeral('I do not know that content.');
      return publicMessage(await party.staticsPayload(dungeon));
    }

    case 'panels': {
      if (!hasManageGuild(body.member)) return ephemeral('That one is for Officers.');
      for (const group of GROUPS) await rest.createMessage(body.channel_id, buildPanel(group));
      await rest.createMessage(body.channel_id, buildGearPanel());
      return ephemeral('Panels posted.');
    }

    default:
      return ephemeral('I do not know that command.');
  }
}

async function runComponent(body, ctx) {
  // The gear button opens a dialog. A modal must BE the response, so this
  // case has to come before anything that would reply with a message.
  if (body.data.custom_id === OPEN_ID) {
    return { type: Reply.Modal, data: buildGearModal(await roster.get(ctx.userId)).toJSON() };
  }

  const parsed = parseCustomId(body.data.custom_id);
  if (!parsed) return ephemeral('That button is not one of mine.');

  const plan = planSelfRole(parsed.group.id, parsed.option.id, ctx.roleNameList);
  if (!plan) return ephemeral('That button is not one of mine.');

  const ids = await rest.roleIdsByName(ctx.guildId);
  const missing = [...plan.add, ...plan.remove].filter((name) => !ids.has(name));
  if (missing.length) {
    return ephemeral(`The **${missing[0]}** role does not exist yet — ping an Officer to run setup.`);
  }

  for (const name of plan.remove) await rest.removeRole(ctx.guildId, ctx.userId, ids.get(name));
  for (const name of plan.add) await rest.addRole(ctx.guildId, ctx.userId, ids.get(name));

  // Keep the cached class and timezone in step with what just changed.
  const after = ctx.roleNameList.filter((n) => !plan.remove.includes(n)).concat(plan.add);
  await roster.cacheProfile(ctx.userId, profileFromRoleNames(after));

  return ephemeral(plan.content);
}

async function runModal(body, ctx) {
  if (body.data.custom_id !== SUBMIT_ID) return ephemeral('Unknown dialog.');
  const fields = modalFields(body.data);
  return ephemeral(
    await gear.applyGearModal(ctx.userId, fields.get(FIELD_ITEM_LEVEL), fields.get(FIELD_CP))
  );
}

// ── entry ──────────────────────────────────────────────────────────────────

async function handleInteraction(body) {
  if (body.type === Type.Ping) return { type: Reply.Pong };

  const guildId = body.guild_id;
  const user = body.member?.user ?? body.user;
  if (!guildId || !user) return ephemeral('This only works inside the server.');

  const roleNames = await rest.roleNamesById(guildId);
  const roleNameList = (body.member?.roles ?? []).map((id) => roleNames.get(id)).filter(Boolean);
  const profile = profileFromRoleNames(roleNameList);

  const ctx = {
    guildId,
    userId: user.id,
    displayName: body.member?.nick || user.global_name || user.username,
    roleNames,
    roleNameList,
    profile,
  };

  // Every interaction is a free chance to refresh the cached class and
  // timezone, which is what lets /lfg skip a REST lookup per member.
  await roster.cacheProfile(ctx.userId, profile);

  if (body.type === Type.Command) return runCommand(body, ctx);
  if (body.type === Type.Component) return runComponent(body, ctx);
  if (body.type === Type.ModalSubmit) return runModal(body, ctx);
  return ephemeral('Unsupported interaction type.');
}

module.exports = { handleInteraction, readOptions, modalFields, hasManageGuild, Type, Reply, EPHEMERAL };
