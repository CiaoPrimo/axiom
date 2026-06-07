// src/handlers/setup.js
const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const config = require('../utils/config');
const { servers } = require('../utils/database');
const logger = require('../utils/logger');

async function handleSetup(interaction) {
    const guild          = interaction.guild;
    const enrollmentInfo = await servers.get(guild.id);

    if (!enrollmentInfo) {
        return interaction.reply({ content: '❌ This server is not enrolled with Axiom.', ephemeral: true });
    }

    const staffRole = guild.roles.cache.find(r => r.name === config.STAFF_ROLE_NAME);
    if (!staffRole || !interaction.member.roles.cache.has(staffRole.id)) {
        return interaction.reply({ content: '❌ Only Axiom Staff can run this command.', ephemeral: true });
    }

    if (enrollmentInfo.setupComplete) {
        return interaction.reply({ content: '⚠️ This server has already been set up.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
        const category = await guild.channels.create({
            name: '📢 Axiom - Global',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
                {
                    id:   guild.id,
                    allow:[PermissionFlagsBits.ViewChannel],
                    deny: [PermissionFlagsBits.SendMessages],
                },
                {
                    id:   staffRole.id,
                    allow:[
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ManageChannels,
                        PermissionFlagsBits.ManageMessages,
                        PermissionFlagsBits.MentionEveryone,
                    ],
                },
            ],
        });

        const announcementsChannel = await guild.channels.create({
            name:   '📢announcements',
            type:   ChannelType.GuildAnnouncement,
            parent: category.id,
            topic:  'Official Axiom announcements and important updates',
        });

        const updatesChannel = await guild.channels.create({
            name:   '🔔updates',
            type:   ChannelType.GuildText,
            parent: category.id,
            topic:  'Service updates, maintenance notices, and system status',
        });

        const welcomeEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎉 Axiom Setup Complete!')
            .setDescription('Your server is now fully integrated with Axiom Services.')
            .addFields(
                { name: '📢 Announcements', value: `${announcementsChannel} — Important announcements are posted here` },
                { name: '🔔 Updates',       value: `${updatesChannel} — Service updates and notifications` },
                { name: '🛠️ Staff Commands', value: '`/globalban` `/globalunban` `/globalannounce` `/serverstatus` `/revokeaccess`' },
            )
            .setFooter({ text: 'Thank you for choosing Axiom!' })
            .setTimestamp();

        await announcementsChannel.send({ embeds: [welcomeEmbed] });

        await servers.set(guild.id, {
            ...enrollmentInfo,
            setupComplete: true,
            channels: {
                announcements: announcementsChannel.id,
                updates:       updatesChannel.id,
            },
        });

        await interaction.editReply('✅ Setup complete! Axiom infrastructure has been deployed.');
        logger.info(`Setup complete — guild: ${guild.name} (${guild.id})`);

    } catch (err) {
        logger.error('Setup error:', err);
        await interaction.editReply('❌ An error occurred during setup. Please verify bot permissions and try again.');
    }
}

module.exports = { handleSetup };
