// src/commands.js
const { SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('enroll')
        .setDescription('Start the enrollment process for a new client')
        .addUserOption(o =>
            o.setName('user').setDescription('The user to enroll').setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Deploy Axiom infrastructure in this server'),

    new SlashCommandBuilder()
        .setName('globalban')
        .setDescription('Ban a user from all Axiom-managed servers')
        .addUserOption(o =>
            o.setName('user').setDescription('User to ban').setRequired(true)
        )
        .addStringOption(o =>
            o.setName('reason').setDescription('Reason for the ban').setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName('globalunban')
        .setDescription('Unban a user from all Axiom-managed servers')
        .addStringOption(o =>
            o.setName('userid').setDescription('Discord User ID to unban').setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('broadcast')
        .setDescription('Send an announcement to every Axiom-managed server\'s announcement channel')
        .addStringOption(o =>
            o.setName('message').setDescription('The announcement message').setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('serverstatus')
        .setDescription('View all servers managed by Axiom'),

    new SlashCommandBuilder()
        .setName('revokeaccess')
        .setDescription('Revoke Axiom access from this server'),
].map(c => c.toJSON());

module.exports = commands;
