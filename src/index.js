// src/index.js
require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    ActivityType,
    REST,
    Routes,
} = require('discord.js');

const config   = require('./utils/config');
const logger   = require('./utils/logger');
const { init: initDb, enrollments } = require('./utils/database');
const commands = require('./commands');

const { handleEnroll, handleGuildCreate, handleEnrollmentButton } = require('./handlers/enroll');
const { handleSetup }                                              = require('./handlers/setup');
const { handleGlobalBan, handleGlobalUnban, handleGlobalAnnounce } = require('./handlers/moderation');
const { handleServerStatus, handleRevokeAccess, handleRevokeButton } = require('./handlers/management');
const { handleRestartCommand }                                     = require('./handlers/restart');
const { handleActivityCommand }                                    = require('./handlers/activity');
const { handleStatusCommand }                                      = require('./handlers/status');

// ── Prefix commands ───────────────────────────────────────────────────────────

const PREFIX = '*-!';
const PREFIX_COMMAND_GUILD_ID = '1380925362128818246';

// ── Client ────────────────────────────────────────────────────────────────────

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
    ],
});

// ── Startup ───────────────────────────────────────────────────────────────────

(async () => {
    // Connect to Postgres and create tables
    await initDb();

    // Register slash commands
    const rest = new REST({ version: '10' }).setToken(config.TOKEN);
    try {
        logger.info('Registering slash commands…');
        await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: commands });
        logger.info('Slash commands registered.');
    } catch (err) {
        logger.error('Failed to register commands:', err);
    }

    await client.login(config.TOKEN);
})();

// ── Ready ─────────────────────────────────────────────────────────────────────

client.once('ready', () => {
    logger.info(`✅  Axiom Bot online as ${client.user.tag}`);
    client.user.setActivity('servers', { type: ActivityType.Watching });

    // Purge stale enrollments on startup and every hour
    enrollments.purgeStale().catch(err => logger.error('Purge error:', err));
    setInterval(() => enrollments.purgeStale().catch(err => logger.error('Purge error:', err)), 60 * 60 * 1000);
});

// ── Interaction router ────────────────────────────────────────────────────────

client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            await routeCommand(interaction);
        } else if (interaction.isButton()) {
            await routeButton(interaction);
        }
    } catch (err) {
        logger.error('Unhandled interaction error:', err);
        const msg = { content: '❌ An unexpected error occurred.', ephemeral: true };
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(msg).catch(() => {});
        } else {
            await interaction.reply(msg).catch(() => {});
        }
    }
});

async function routeCommand(interaction) {
    switch (interaction.commandName) {
        case 'enroll':         return handleEnroll(interaction);
        case 'setup':          return handleSetup(interaction);
        case 'globalban':      return handleGlobalBan(interaction, client);
        case 'globalunban':    return handleGlobalUnban(interaction, client);
        case 'globalannounce': return handleGlobalAnnounce(interaction, client);
        case 'serverstatus':   return handleServerStatus(interaction, client);
        case 'revokeaccess':   return handleRevokeAccess(interaction);
        default: logger.warn(`Unknown command: ${interaction.commandName}`);
    }
}

async function routeButton(interaction) {
    const id = interaction.customId;

    const enrollMatch = id.match(/^(confirm|deny)_enrollment_(\d+)$/);
    if (enrollMatch) {
        const [, action, userId] = enrollMatch;
        return handleEnrollmentButton(interaction, userId, action === 'confirm', client);
    }

    switch (id) {
        case 'confirm_revoke': return handleRevokeButton(interaction, true);
        case 'cancel_revoke':  return handleRevokeButton(interaction, false);
        default: logger.warn(`Unknown button: ${id}`);
    }
}

// ── Prefix command router ─────────────────────────────────────────────────────

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    // Restrict prefix commands to a single guild, and require Administrator there.
    if (message.guild?.id !== PREFIX_COMMAND_GUILD_ID) return;
    if (!message.member?.permissions.has('Administrator')) {
        return message.reply('❌ You need Administrator permission in this server to use this command.').catch(() => {});
    }

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    try {
        switch (commandName) {
            case 'restart':  return await handleRestartCommand(message, args);
            case 'activity': return await handleActivityCommand(message, args, client);
            case 'status':   return await handleStatusCommand(message, args, client);
            default: return; // unknown prefix command, ignore silently
        }
    } catch (err) {
        logger.error(`Prefix command "${commandName}" error:`, err);
        message.reply('❌ Something went wrong running that command.').catch(() => {});
    }
});

// ── Guild lifecycle ───────────────────────────────────────────────────────────

client.on('guildCreate', guild => handleGuildCreate(guild, client));

client.on('guildDelete', async guild => {
    const { servers } = require('./utils/database');
    const data = await servers.get(guild.id);
    if (data) {
        await servers.delete(guild.id);
        logger.info(`Cleaned up removed guild: ${guild.name} (${guild.id})`);
    }
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(signal) {
    logger.info(`${signal} received — shutting down…`);
    client.destroy();
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', err => logger.error('Unhandled rejection:', err));
process.on('uncaughtException',  err => { logger.error('Uncaught exception:', err); process.exit(1); });
