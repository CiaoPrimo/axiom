// src/deploy-commands.js
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const config = require('./utils/config');
const logger = require('./utils/logger');

async function deployCommands() {
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        } else {
            logger.error(`Command file ${file} is missing "data" or "execute" — skipped.`);
        }
    }

    const rest = new REST().setToken(config.TOKEN);

    try {
        logger.info(`Reloading ${commands.length} application (/) command(s)...`);

        // Guild-scoped registration: updates instantly, good for active development.
        const data = await rest.put(
            Routes.applicationGuildCommands(config.CLIENT_ID, config.MAIN_GUILD_ID),
            { body: commands },
        );

        logger.info(`Successfully reloaded ${data.length} command(s) in guild ${config.MAIN_GUILD_ID}.`);
    } catch (err) {
        logger.error('Failed to reload commands:', err);
        process.exit(1);
    }
}

deployCommands();
