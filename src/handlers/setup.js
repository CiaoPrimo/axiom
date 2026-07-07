// src/handlers/setup.js
const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const config = require('../utils/config');
const { servers } = require('../utils/database');
const logger = require('../utils/logger');

// Finds an existing text channel by name, or creates it if it doesn't exist.
async function getOrCreateChannel(guild, channelName) {
    let channel = guild.channels.cache.find(
        c => c.type === ChannelType.GuildText && c.name === channelName
    );

    if (!channel) {
        channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            reason: 'Axiom setup — required channel did not exist',
        });
    }

    return channel;
}

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
        // Resolve (or create) the channels before referencing them below.
        // Uses config values if present, falling back to sensible default names.
        const announcementsChannelName = config.ANNOUNCEMENTS_CHANNEL_NAME || 'axiom-announcements';
        const updatesChannelName       = config.UPDATES_CHANNEL_NAME || 'axiom-updates';

        const announcementsChannel = await getOrCreateChannel(guild, announcementsChannelName);
        const updatesChannel       = await getOrCreateChannel(guild, updatesChannelName);

        const welcomeEmbed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle('🎉 Axiom Setup Complete!')
            .setDescription('Your server is now fully integrated with Axiom Services.')
            .addFields(
                { name: 'Announcements', value: `${announcementsChannel} — Important announcements are posted here` },
                { name: 'Updates',       value: `${updatesChannel} — Service updates and notifications` },
                { name: 'Staff Commands', value: '`/globalban` `/globalunban` `/serverstatus` `/revokeaccess`' },
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
