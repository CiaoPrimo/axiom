// src/utils/config.js
const logger = require('./logger');

const REQUIRED = [
    'DISCORD_TOKEN',
    'CLIENT_ID',
    'MAIN_GUILD_ID',
    'ENROLLMENT_ROLE_ID',
    'INVITE_URL',
    'DATABASE_URL',
];

function loadConfig() {
    const missing = REQUIRED.filter(k => !process.env[k]);
    if (missing.length) {
        logger.error(`Missing required environment variables: ${missing.join(', ')}`);
        logger.error('Copy .env.example to .env and fill in all values.');
        process.exit(1);
    }

    return {
        TOKEN:              process.env.DISCORD_TOKEN,
        CLIENT_ID:          process.env.CLIENT_ID,
        MAIN_GUILD_ID:      process.env.MAIN_GUILD_ID,
        ENROLLMENT_ROLE_ID: process.env.ENROLLMENT_ROLE_ID,
        STAFF_ROLE_NAME:    process.env.STAFF_ROLE_NAME || 'Axiom Staff',
        INVITE_URL:         process.env.INVITE_URL,
        COMPANY_WEBSITE:    process.env.COMPANY_WEBSITE || 'https://axiomrblx.pages.dev',
        DATABASE_URL:       process.env.DATABASE_URL,
    };
}

module.exports = loadConfig();
