// src/handlers/moderation.js
const { EmbedBuilder } = require('discord.js');
const config = require('../utils/config');
const { servers, bans } = require('../utils/database');
const logger = require('../utils/logger');

function isAxiomStaff(interaction) {
    const staffRole = interaction.guild.roles.cache.find(r => r.name === config.STAFF_ROLE_NAME);
    return staffRole && interaction.member.roles.cache.has(staffRole.id);
}

async function handleGlobalBan(interaction, client) {
    if (!isAxiomStaff(interaction)) {
        return interaction.reply({ content: '❌ Only Axiom Staff can use this command.', ephemeral: true });
    }

    const user       = interaction.options.getUser('user');
    const reason     = interaction.options.getString('reason') || 'No reason provided';
    const allServers = await servers.all();

    await interaction.deferReply();
    await bans.add(user.id, interaction.user.id, reason);

    let bannedCount = 0, failedCount = 0;

    await Promise.allSettled(
        allServers.map(async ({ guildId }) => {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return;
            try {
                await guild.members.ban(user.id, {
                    reason: `[Axiom Global Ban] ${reason} — by ${interaction.user.tag}`,
                    deleteMessageSeconds: 86400,
                });
                bannedCount++;
            } catch (err) {
                logger.warn(`Global ban failed in ${guild.name}: ${err.message}`);
                failedCount++;
            }
        }),
    );

    const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔨 Global Ban Executed')
        .setDescription(`**User:** ${user.tag} (\`${user.id}\`)\n**Reason:** ${reason}\n**Banned by:** ${interaction.user.tag}`)
        .addFields(
            { name: '✅ Banned', value: `${bannedCount} server(s)`, inline: true },
            { name: '❌ Failed', value: `${failedCount} server(s)`, inline: true },
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    logger.info(`Global ban: ${user.tag} (${user.id}) — ${reason}`);
}

async function handleGlobalUnban(interaction, client) {
    if (!isAxiomStaff(interaction)) {
        return interaction.reply({ content: '❌ Only Axiom Staff can use this command.', ephemeral: true });
    }

    const userId = interaction.options.getString('userid').trim();
    if (!/^\d{17,20}$/.test(userId)) {
        return interaction.reply({ content: '❌ Invalid user ID format.', ephemeral: true });
    }

    const allServers = await servers.all();
    await interaction.deferReply();
    await bans.remove(userId);

    let unbannedCount = 0, failedCount = 0;

    await Promise.allSettled(
        allServers.map(async ({ guildId }) => {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return;
            try {
                await guild.members.unban(userId, `[Axiom Global Unban] by ${interaction.user.tag}`);
                unbannedCount++;
            } catch { failedCount++; }
        }),
    );

    const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🔓 Global Unban Executed')
        .setDescription(`**User ID:** \`${userId}\`\n**Unbanned by:** ${interaction.user.tag}`)
        .addFields(
            { name: '✅ Unbanned', value: `${unbannedCount} server(s)`, inline: true },
            { name: '❌ Failed',   value: `${failedCount} server(s)`,   inline: true },
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    logger.info(`Global unban: ${userId} by ${interaction.user.tag}`);
}

async function handleGlobalAnnounce(interaction, client) {
    if (!isAxiomStaff(interaction)) {
        return interaction.reply({ content: '❌ Only Axiom Staff can use this command.', ephemeral: true });
    }

    const message    = interaction.options.getString('message');
    const allServers = await servers.all();

    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📢 Axiom Announcement')
        .setDescription(message)
        .setFooter({ text: `Sent by ${interaction.user.tag}` })
        .setTimestamp();

    let sentCount = 0;

    await Promise.allSettled(
        allServers
            .filter(s => s.channels?.announcements)
            .map(async ({ guildId, channels }) => {
                const guild   = client.guilds.cache.get(guildId);
                const channel = guild?.channels.cache.get(channels.announcements);
                if (!channel) return;
                try {
                    await channel.send({ embeds: [embed] });
                    sentCount++;
                } catch (err) {
                    logger.warn(`Announce failed in ${guildId}: ${err.message}`);
                }
            }),
    );

    await interaction.editReply(`✅ Announcement sent to **${sentCount}** server(s).`);
    logger.info(`Global announce by ${interaction.user.tag} → ${sentCount} servers`);
}

module.exports = { handleGlobalBan, handleGlobalUnban, handleGlobalAnnounce };
