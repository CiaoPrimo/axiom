// src/utils/broadcast.js
const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} = require('discord.js');
const { servers } = require('./database');
const logger = require('./logger');

// Builds a Components V2 container for a global broadcast message.
// accentColor: integer color (e.g. 0x2B2D31) — avoid Discord blurple (0x5865F2).
function buildBroadcastContainer({ heading, body, accentColor = 0x2B2D31, footer }) {
    const container = new ContainerBuilder().setAccentColor(accentColor);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${heading}`)
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(body)
    );

    if (footer) {
        container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# ${footer}`)
        );
    }

    return container;
}

// Sends a pre-built CV2 container to a specific channel key ('announcements' | 'updates')
// across every enrolled server. Returns a summary of successes/failures.
async function broadcastToAllServers(client, channelKey, container) {
    const allServers = await servers.all();
    const results = { success: 0, failed: [] };

    for (const server of allServers) {
        const channelId = server?.channels?.[channelKey];
        if (!channelId) {
            results.failed.push({ guildId: server.guildId, reason: 'No channel configured' });
            continue;
        }

        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel) {
                results.failed.push({ guildId: server.guildId, reason: 'Channel not found' });
                continue;
            }

            await channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });

            results.success += 1;
        } catch (err) {
            logger.error(`Broadcast failed for guild ${server.guildId}:`, err);
            results.failed.push({ guildId: server.guildId, reason: err.message });
        }
    }

    return results;
}

module.exports = { buildBroadcastContainer, broadcastToAllServers };
