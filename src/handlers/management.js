// src/handlers/management.js
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const config = require('../utils/config');
const { servers } = require('../utils/database');
const logger = require('../utils/logger');

function isAxiomStaff(interaction) {
    const staffRole = interaction.guild.roles.cache.find(r => r.name === config.STAFF_ROLE_NAME);
    return staffRole && interaction.member.roles.cache.has(staffRole.id);
}

async function handleServerStatus(interaction, client) {
    if (!isAxiomStaff(interaction)) {
        return interaction.reply({ content: '❌ Only Axiom Staff can use this command.', ephemeral: true });
    }

    const allServers = await servers.all();

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📊 Axiom Managed Servers')
        .setDescription(`Currently managing **${allServers.length}** server(s)`)
        .setTimestamp();

    if (allServers.length === 0) {
        embed.addFields({ name: 'No servers', value: 'No servers are currently enrolled.' });
    } else {
        const lines = allServers.map(({ guildId, setupComplete }) => {
            const guild  = client.guilds.cache.get(guildId);
            const status = setupComplete ? '✅' : '⚠️';
            return guild
                ? `${status} **${guild.name}** — ${guild.memberCount.toLocaleString()} members`
                : `${status} Unknown server (\`${guildId}\`)`;
        });

        for (let i = 0; i < lines.length; i += 20) {
            embed.addFields({
                name:  i === 0 ? 'Servers' : '​',
                value: lines.slice(i, i + 20).join('\n'),
            });
        }
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRevokeAccess(interaction) {
    if (interaction.user.id !== interaction.guild.ownerId) {
        return interaction.reply({ content: '❌ Only the server owner can revoke Axiom access.', ephemeral: true });
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('confirm_revoke')
            .setLabel('Yes, Revoke Access')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚠️'),
        new ButtonBuilder()
            .setCustomId('cancel_revoke')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
        content: '⚠️ **Are you sure?** This will remove the Axiom Staff role and the bot will leave your server. You will need to re-enroll to get access back.',
        components: [row],
        ephemeral: true,
    });
}

async function handleRevokeButton(interaction, confirmed) {
    if (interaction.user.id !== interaction.guild.ownerId) {
        return interaction.reply({ content: '❌ Only the server owner can confirm this.', ephemeral: true });
    }

    if (!confirmed) {
        await interaction.update({ content: '✅ Revoke cancelled. Axiom access has been retained.', components: [] });
        return;
    }

    await interaction.update({ content: '⏳ Revoking access…', components: [] });

    const guild     = interaction.guild;
    const staffRole = guild.roles.cache.find(r => r.name === config.STAFF_ROLE_NAME);

    try {
        if (staffRole) await staffRole.delete('Axiom access revoked by server owner');
    } catch (err) {
        logger.warn(`Could not delete staff role in ${guild.id}: ${err.message}`);
    }

    await servers.delete(guild.id);
    logger.info(`Access revoked — guild: ${guild.name} (${guild.id})`);

    try {
        await interaction.followUp({ content: '✅ Axiom access revoked. Goodbye!', ephemeral: true });
    } catch { /* interaction may be stale */ }

    await guild.leave();
}

module.exports = { handleServerStatus, handleRevokeAccess, handleRevokeButton };
