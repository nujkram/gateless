// /panels — re-post the self-role panels in the current channel.
// Setup already posts them; this is for when a channel gets cleared.

const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { GROUPS } = require('../config/selfroles');
const { buildPanel } = require('../lib/panels');

const data = new SlashCommandBuilder()
  .setName('panels')
  .setDescription('Re-post the class, content and timezone panels in this channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

async function execute(interaction) {
  for (const group of GROUPS) await interaction.channel.send(buildPanel(group));
  return interaction.reply({ content: 'Panels posted.', flags: MessageFlags.Ephemeral });
}

module.exports = { data, execute };
