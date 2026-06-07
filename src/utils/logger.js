// src/utils/logger.js
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const COLORS = {
    error: '\x1b[31m',
    warn:  '\x1b[33m',
    info:  '\x1b[36m',
    debug: '\x1b[90m',
    reset: '\x1b[0m',
};

const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function log(level, ...args) {
    if (LEVELS[level] > currentLevel) return;
    const ts = new Date().toISOString();
    console[level === 'error' ? 'error' : 'log'](
        `${COLORS.reset}[${ts}] ${COLORS[level]}[${level.toUpperCase()}]${COLORS.reset}`,
        ...args
    );
}

module.exports = {
    error: (...a) => log('error', ...a),
    warn:  (...a) => log('warn',  ...a),
    info:  (...a) => log('info',  ...a),
    debug: (...a) => log('debug', ...a),
};
