// src/commands/global-announcement.js
const { SlashCommandBuilder } = require('discord.js');
const config = require('../utils/config');
const logger = require('../utils/logger');
const { buildBroadcastContainer, broadcastToAllServers } = require('../utils/broadcast');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('broadcast')
        .setDescription('Send an announcement to every enrolled Axiom server.')
        .addStringOption(opt =>
            opt.setName('title')
                .setDescription('Announcement title')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('message')
                .setDescription('Announcement body')
                .setRequired(true)),

    async execute(interaction) {
        if (interaction.guild.id !== config.MAIN_GUILD_ID) {
            return interaction.reply({ content: 'This command can only be run in the main Axiom server.', ephemeral: true });
        }

        const staffRole = interaction.guild.roles.cache.find(r => r.name === config.STAFF_ROLE_NAME);
        if (!staffRole || !interaction.member.roles.cache.has(staffRole.id)) {
            return interaction.reply({ content: 'Only Axiom Staff can run this command.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const title   = interaction.options.getString('title');
        const message = interaction.options.getString('message');

        const container = buildBroadcastContainer({
            heading: `${title}`,
            body: message,
            footer: 'Axiom Global Announcement',
        });

        const results = await broadcastToAllServers(interaction.client, 'announcements', container);

        logger.info(`Global announcement sent — success: ${results.success}, failed: ${results.failed.length}`);

        const failedSummary = results.failed.length
            ? `\n\nFailed (${results.failed.length}):\n` + results.failed
                .map(f => `• ${f.guildId} — ${f.reason}`)
                .join('\n')
            : '';

        await interaction.editReply(
            `Announcement sent to **${results.success}** server(s).${failedSummary}`
        );
    },
};
