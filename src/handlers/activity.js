// src/handlers/activity.js
const { ActivityType } = require('discord.js');
const logger = require('../utils/logger');

const ACTIVITY_TYPES = {
    playing: ActivityType.Playing,
    listening: ActivityType.Listening,
    watching: ActivityType.Watching,
    competing: ActivityType.Competing,
};

async function handleActivityCommand(message, args, client) {
    const typeArg = args.shift()?.toLowerCase();
    const activityType = ACTIVITY_TYPES[typeArg];

    if (!activityType) {
        return message.reply(
            `⚠️ Invalid activity type. Use one of: ${Object.keys(ACTIVITY_TYPES).join(', ')}.\n` +
            'Usage: `*-!activity <type> <text>` (e.g. `*-!activity watching servers`)'
        );
    }

    const text = args.join(' ').trim();
    if (!text) {
        return message.reply('⚠️ Please provide activity text. Usage: `*-!activity <type> <text>`');
    }

    try {
        client.user.setActivity(text, { type: activityType });
        await message.reply(`✅ Activity set to **${typeArg} ${text}**.`);
    } catch (err) {
        logger.error('Activity command error:', err);
        await message.reply('❌ Failed to update activity.');
    }
}

module.exports = { handleActivityCommand };
