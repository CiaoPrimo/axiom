// src/handlers/enroll.js
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
} = require('discord.js');
const config = require('../utils/config');
const { enrollments, servers } = require('../utils/database');
const logger = require('../utils/logger');

async function handleEnroll(interaction) {
    if (interaction.guild.id !== config.MAIN_GUILD_ID) {
        return interaction.reply({ content: '❌ This command can only be used in the main Axiom server.', ephemeral: true });
    }
    if (!interaction.member.roles.cache.has(config.ENROLLMENT_ROLE_ID)) {
        return interaction.reply({ content: '❌ You do not have permission to enroll users.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user');
    if (targetUser.bot) {
        return interaction.reply({ content: '❌ You cannot enroll a bot.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📋 Axiom Services — Enrollment Agreement')
        .setDescription(`**Client:** ${targetUser.tag}\n**Initiated by:** ${interaction.user.tag}`)
        .addFields(
            { name: '📜 Terms of Service', value: 'By proceeding you agree to Axiom\'s ToS. Axiom staff will receive administrative access to your Discord server and Roblox group.' },
            { name: '🔒 Privacy & Security', value: 'Axiom commits to protecting your community data and will only use permissions for agreed-upon management services.' },
            { name: '⚙️ Services Included', value: '• Discord Server Management\n• Roblox Group Administration\n• Moderation Support\n• Custom Automation\n• 24/7 Support' },
            { name: '💼 Next Steps', value: `${targetUser}, click **Add Axiom Bot** below, authorise all permissions, then wait for staff confirmation.` },
        )
        .setFooter({ text: 'Axiom Services • axiomrblx.pages.dev' })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('Add Axiom Bot')
            .setStyle(ButtonStyle.Link)
            .setURL(config.INVITE_URL)
            .setEmoji('🤖'),
    );

    await interaction.reply({ embeds: [embed], components: [row] });

    await enrollments.set(targetUser.id, {
        enrolledBy: interaction.user.id,
        startTime:  Date.now(),
        stage:      'awaiting_bot_add',
    });

    logger.info(`Enrollment started for ${targetUser.tag} by ${interaction.user.tag}`);

    try {
        const dmEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎉 Welcome to Axiom Services!')
            .setDescription(`You've been enrolled by **${interaction.user.tag}**. Add the Axiom bot to your server to continue.`)
            .addFields({ name: '📌 Steps', value: '1. Click "Add Axiom Bot"\n2. Select your server\n3. Authorise all permissions\n4. Wait for staff confirmation' })
            .setFooter({ text: 'Questions? Contact Axiom Support' });

        await targetUser.send({ embeds: [dmEmbed], components: [row] });
    } catch {
        logger.warn(`Could not DM ${targetUser.tag} — DMs may be closed`);
    }
}

async function handleGuildCreate(guild, client) {
    logger.info(`Bot added to: ${guild.name} (${guild.id})`);

    const owner      = await guild.fetchOwner();
    const enrollData = await enrollments.get(owner.id);

    if (!enrollData) {
        await sendGenericWelcome(guild);
        return;
    }

    const permissionEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🔐 Staff Access Request')
        .setDescription(`**Server:** ${guild.name}\n**Owner:** ${owner.user.tag}`)
        .addFields(
            { name: '⚠️ Action Required', value: `${owner}, click **Grant Staff Access** to complete enrollment.` },
            { name: '✅ What happens next?', value: '• An "Axiom Staff" role is created with admin permissions\n• The assigned staff member receives a one-time invite\n• You retain full ownership at all times' },
        )
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`confirm_enrollment_${owner.id}`)
            .setLabel('Grant Staff Access')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
        new ButtonBuilder()
            .setCustomId(`deny_enrollment_${owner.id}`)
            .setLabel('Cancel Enrollment')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌'),
    );

    try {
        const channel = guild.systemChannel
            ?? (await guild.channels.fetch()).find(
                c => c.type === ChannelType.GuildText
                  && c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages),
            );
        if (channel) await channel.send({ content: `${owner}`, embeds: [permissionEmbed], components: [row] });
    } catch (err) {
        logger.error('Could not send permission request:', err);
    }

    await enrollments.set(owner.id, { ...enrollData, guildId: guild.id, stage: 'awaiting_permission' });
}

async function handleEnrollmentButton(interaction, userId, confirmed, client) {
    if (interaction.user.id !== userId) {
        return interaction.reply({ content: '❌ Only the enrolled user can respond to this.', ephemeral: true });
    }

    if (!confirmed) {
        await enrollments.delete(userId);
        await interaction.reply({ content: '❌ Enrollment cancelled. The bot will leave this server.', ephemeral: true });
        await interaction.message.edit({ components: [] });
        await interaction.guild.leave();
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    const enrollData = await enrollments.get(userId);
    if (!enrollData) {
        return interaction.editReply('❌ Enrollment data not found. Please contact support.');
    }

    const guild       = interaction.guild;
    const mainGuild   = client.guilds.cache.get(config.MAIN_GUILD_ID);
    const staffMember = await mainGuild.members.fetch(enrollData.enrolledBy).catch(() => null);

    if (!staffMember) {
        return interaction.editReply('❌ Could not find the enrolling staff member. Please contact support.');
    }

    try {
        const staffRole = await guild.roles.create({
            name:        config.STAFF_ROLE_NAME,
            color:       0x5865F2,
            permissions: [PermissionFlagsBits.Administrator],
            hoist:       true,
            reason:      'Axiom enrollment — staff access',
        });

        const guildStaff = guild.members.cache.get(staffMember.id);
        if (guildStaff) {
            await guildStaff.roles.add(staffRole);
        } else {
            const textChannel = guild.systemChannel
                ?? (await guild.channels.fetch()).find(c => c.type === ChannelType.GuildText);
            if (textChannel) {
                const invite = await textChannel.createInvite({ maxAge: 86400, maxUses: 1, unique: true });
                await staffMember.send(
                    `🎉 **${guild.name}** has granted access!\n🔗 One-time invite (24 h): ${invite.url}\nOnce inside, run \`/setup\` to complete deployment.`
                ).catch(() => logger.warn('Could not DM staff member'));
            }
        }

        await servers.set(guild.id, {
            ownerId:      userId,
            enrolledBy:   enrollData.enrolledBy,
            enrolledAt:   Date.now(),
            setupComplete: false,
        });

        await enrollments.delete(userId);

        await interaction.message.edit({ components: [] });
        await interaction.editReply('✅ Access granted! An Axiom representative will run `/setup` to finish deployment.');

        const followUp = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ Enrollment Confirmed')
            .setDescription('Axiom staff now has access. Expect setup to complete shortly.')
            .setTimestamp();

        await interaction.followUp({ embeds: [followUp] });
        logger.info(`Enrollment confirmed — guild: ${guild.name} (${guild.id})`);

    } catch (err) {
        logger.error('Enrollment confirmation error:', err);
        await interaction.editReply('❌ Failed to grant staff access. Please contact Axiom support.');
    }
}

async function sendGenericWelcome(guild) {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('👋 Thanks for adding Axiom!')
        .setDescription('This server has not been enrolled yet. Visit our website to learn more.')
        .addFields({ name: '🌐 Website', value: config.COMPANY_WEBSITE })
        .setTimestamp();

    try {
        const channel = guild.systemChannel
            ?? (await guild.channels.fetch()).find(c => c.type === ChannelType.GuildText);
        if (channel) await channel.send({ embeds: [embed] });
    } catch (err) {
        logger.warn('Could not send generic welcome:', err.message);
    }
}

module.exports = { handleEnroll, handleGuildCreate, handleEnrollmentButton };
