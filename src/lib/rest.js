// Discord REST, with no gateway attached.
//
// Everything the HTTP endpoint needs to act on a guild: look up roles, add
// and remove them, and edit a deferred reply. @discordjs/rest handles rate
// limiting; discord.js itself is not involved.

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

let client = null;
function rest() {
  if (!client) {
    const token = process.env.DISCORD_TOKEN;
    if (!token) throw new Error('DISCORD_TOKEN is not set');
    client = new REST({ version: '10' }).setToken(token);
  }
  return client;
}

// Guild roles change rarely and a lambda instance is short-lived, so a small
// in-memory cache saves a round trip on most interactions without going stale
// in any way that matters.
const roleCache = new Map(); // guildId -> { at, roles }
const ROLE_TTL_MS = 60_000;

async function guildRoles(guildId) {
  const hit = roleCache.get(guildId);
  if (hit && Date.now() - hit.at < ROLE_TTL_MS) return hit.roles;

  const roles = await rest().get(Routes.guildRoles(guildId));
  roleCache.set(guildId, { at: Date.now(), roles });
  return roles;
}

async function roleIdsByName(guildId) {
  const roles = await guildRoles(guildId);
  return new Map(roles.map((r) => [r.name, r.id]));
}

async function roleNamesById(guildId) {
  const roles = await guildRoles(guildId);
  return new Map(roles.map((r) => [r.id, r.name]));
}

const addRole = (guildId, userId, roleId) =>
  rest().put(Routes.guildMemberRole(guildId, userId, roleId), { reason: 'Gateless self-role' });

const removeRole = (guildId, userId, roleId) =>
  rest().delete(Routes.guildMemberRole(guildId, userId, roleId), { reason: 'Gateless self-role' });

const getMember = (guildId, userId) => rest().get(Routes.guildMember(guildId, userId));

// Replaces the "thinking" placeholder left by a deferred response.
const editReply = (applicationId, interactionToken, body) =>
  rest().patch(Routes.webhookMessage(applicationId, interactionToken, '@original'), { body });

const createMessage = (channelId, body) =>
  rest().post(Routes.channelMessages(channelId), { body });

const registerGuildCommands = (applicationId, guildId, commands) =>
  rest().put(Routes.applicationGuildCommands(applicationId, guildId), { body: commands });

module.exports = {
  rest,
  guildRoles,
  roleIdsByName,
  roleNamesById,
  addRole,
  removeRole,
  getMember,
  editReply,
  createMessage,
  registerGuildCommands,
};
