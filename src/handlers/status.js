// src/handlers/status.js
const logger = require('../utils/logger');

const VALID_STATUSES = ['online', 'idle', 'dnd', 'invisible'];

async function handleStatusCommand(message, args, client) {
    const statusArg = args[0]?.toLowerCase();

    if (!VALID_STATUSES.includes(statusArg)) {
        return message.reply(
            `⚠️ Invalid status. Use one of: ${VALID_STATUSES.join(', ')}.\n` +
            'Usage: `*-!status <status>`'
        );
    }

    try {
        client.user.setStatus(statusArg);
        await message.reply(`✅ Status set to **${statusArg}**.`);
    } catch (err) {
        logger.error('Status command error:', err);
        await message.reply('❌ Failed to update status.');
    }
}

module.exports = { handleStatusCommand };
