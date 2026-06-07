// src/utils/database.js
const { Pool } = require('pg');
const config   = require('./config');
const logger   = require('./logger');

const pool = new Pool({ connectionString: config.DATABASE_URL });

pool.on('error', (err) => logger.error('Postgres pool error:', err));

// ── Schema setup ─────────────────────────────────────────────────────────────

async function init() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS active_enrollments (
            user_id      TEXT PRIMARY KEY,
            enrolled_by  TEXT NOT NULL,
            guild_id     TEXT,
            stage        TEXT NOT NULL DEFAULT 'awaiting_bot_add',
            started_at   BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS enrolled_servers (
            guild_id           TEXT PRIMARY KEY,
            owner_id           TEXT NOT NULL,
            enrolled_by        TEXT NOT NULL,
            enrolled_at        BIGINT NOT NULL,
            setup_complete     BOOLEAN NOT NULL DEFAULT FALSE,
            announcements_id   TEXT,
            updates_id         TEXT
        );

        CREATE TABLE IF NOT EXISTS global_bans (
            user_id    TEXT PRIMARY KEY,
            banned_by  TEXT NOT NULL,
            reason     TEXT NOT NULL DEFAULT 'No reason provided',
            banned_at  BIGINT NOT NULL
        );
    `);
    logger.info('Database tables ready');
}

// ── Active enrollments ────────────────────────────────────────────────────────

const enrollments = {
    async set(userId, data) {
        await pool.query(`
            INSERT INTO active_enrollments (user_id, enrolled_by, guild_id, stage, started_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO UPDATE SET
                enrolled_by = EXCLUDED.enrolled_by,
                guild_id    = EXCLUDED.guild_id,
                stage       = EXCLUDED.stage
        `, [userId, data.enrolledBy, data.guildId ?? null, data.stage, data.startTime ?? Date.now()]);
    },

    async get(userId) {
        const { rows } = await pool.query(
            'SELECT * FROM active_enrollments WHERE user_id = $1', [userId]
        );
        if (!rows[0]) return null;
        const r = rows[0];
        return { enrolledBy: r.enrolled_by, guildId: r.guild_id, stage: r.stage, startTime: Number(r.started_at) };
    },

    async delete(userId) {
        await pool.query('DELETE FROM active_enrollments WHERE user_id = $1', [userId]);
    },

    async purgeStale() {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const { rowCount } = await pool.query(
            'DELETE FROM active_enrollments WHERE started_at < $1', [cutoff]
        );
        if (rowCount) logger.info(`Purged ${rowCount} stale enrollment(s)`);
    },
};

// ── Enrolled servers ──────────────────────────────────────────────────────────

const servers = {
    async set(guildId, data) {
        await pool.query(`
            INSERT INTO enrolled_servers
                (guild_id, owner_id, enrolled_by, enrolled_at, setup_complete, announcements_id, updates_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (guild_id) DO UPDATE SET
                setup_complete   = EXCLUDED.setup_complete,
                announcements_id = EXCLUDED.announcements_id,
                updates_id       = EXCLUDED.updates_id
        `, [
            guildId,
            data.ownerId,
            data.enrolledBy,
            data.enrolledAt ?? Date.now(),
            data.setupComplete ?? false,
            data.channels?.announcements ?? null,
            data.channels?.updates ?? null,
        ]);
    },

    async get(guildId) {
        const { rows } = await pool.query(
            'SELECT * FROM enrolled_servers WHERE guild_id = $1', [guildId]
        );
        if (!rows[0]) return null;
        const r = rows[0];
        return {
            ownerId:      r.owner_id,
            enrolledBy:   r.enrolled_by,
            enrolledAt:   Number(r.enrolled_at),
            setupComplete: r.setup_complete,
            channels: { announcements: r.announcements_id, updates: r.updates_id },
        };
    },

    async delete(guildId) {
        await pool.query('DELETE FROM enrolled_servers WHERE guild_id = $1', [guildId]);
    },

    async all() {
        const { rows } = await pool.query('SELECT * FROM enrolled_servers');
        return rows.map(r => ({
            guildId:      r.guild_id,
            ownerId:      r.owner_id,
            enrolledBy:   r.enrolled_by,
            enrolledAt:   Number(r.enrolled_at),
            setupComplete: r.setup_complete,
            channels: { announcements: r.announcements_id, updates: r.updates_id },
        }));
    },
};

// ── Global bans ───────────────────────────────────────────────────────────────

const bans = {
    async add(userId, bannedBy, reason) {
        await pool.query(`
            INSERT INTO global_bans (user_id, banned_by, reason, banned_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id) DO UPDATE SET
                banned_by = EXCLUDED.banned_by,
                reason    = EXCLUDED.reason,
                banned_at = EXCLUDED.banned_at
        `, [userId, bannedBy, reason, Date.now()]);
    },

    async remove(userId) {
        await pool.query('DELETE FROM global_bans WHERE user_id = $1', [userId]);
    },
};

module.exports = { init, enrollments, servers, bans };
