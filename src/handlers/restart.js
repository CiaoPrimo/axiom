// src/handlers/restart.js
const logger = require('../utils/logger');

const DEPLOY_URL = 'https://dokploy.westmonthotel.com/api/deploy/6IiXFqF1Mc0fd92Vtes92';

async function handleRestartCommand(message) {
    const statusMsg = await message.reply('🔄 Triggering restart...');

    try {
        const response = await fetch(DEPLOY_URL, { method: 'POST' });

        if (response.ok) {
            await statusMsg.edit('✅ Restart triggered successfully.');
        } else {
            const body = await response.text().catch(() => '');
            await statusMsg.edit(
                `⚠️ Deploy request failed (status ${response.status}).${
                    body ? ` Response: \`${body.slice(0, 200)}\`` : ''
                }`
            );
        }
    } catch (err) {
        logger.error('Restart command error:', err);
        await statusMsg.edit('❌ Failed to reach the deploy API. Check the bot logs for details.');
    }
}

module.exports = { handleRestartCommand };
