'use strict';

const LEVELS = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
});

function getDefaultFormat() {
  if (typeof process.env.LOG_FORMAT === 'string' && process.env.LOG_FORMAT.trim() !== '') {
    return process.env.LOG_FORMAT.trim().toLowerCase();
  }

  return process.env.NODE_ENV === 'production' ? 'json' : 'pretty';
}

function getDefaultLevel() {
  if (typeof process.env.LOG_LEVEL === 'string' && process.env.LOG_LEVEL.trim() !== '') {
    return process.env.LOG_LEVEL.trim().toLowerCase();
  }

  return process.env.NODE_ENV === 'production' ? 'warn' : 'info';
}

function getLevelValue(level) {
  return Object.prototype.hasOwnProperty.call(LEVELS, level) ? LEVELS[level] : LEVELS.info;
}

function formatScope(scope) {
  const normalized = typeof scope === 'string' ? scope.trim() : '';
  return normalized ? `[${normalized}]` : '[app]';
}

function normalizeScope(scope) {
  const normalized = typeof scope === 'string' ? scope.trim() : '';
  return normalized || 'app';
}

function shouldLog(level) {
  return getLevelValue(level) >= getLevelValue(getDefaultLevel());
}

function normalizeArg(arg) {
  if (arg instanceof Error) {
    return {
      name: arg.name,
      message: arg.message,
      stack: arg.stack,
      code: arg.code,
    };
  }

  return arg;
}

function splitArgs(args) {
  const normalized = args.map(normalizeArg);
  const messages = [];
  const data = [];

  for (const item of normalized) {
    if (typeof item === 'string') {
      messages.push(item);
    } else {
      data.push(item);
    }
  }

  return {
    message: messages.join(' ').trim(),
    data,
  };
}

function write(method, scope, args) {
  if (!shouldLog(method)) return;

  const consoleMethod = method === 'debug' ? 'log' : method;
  const timestamp = new Date().toISOString();
  const format = getDefaultFormat();
  const payload = splitArgs(args);

  if (format === 'json') {
    const record = {
      timestamp,
      level: method,
      scope: normalizeScope(scope),
    };

    if (payload.message) {
      record.message = payload.message;
    }
    if (payload.data.length === 1) {
      record.data = payload.data[0];
    } else if (payload.data.length > 1) {
      record.data = payload.data;
    }

    console[consoleMethod](JSON.stringify(record));
    return;
  }

  if (payload.message) {
    console[consoleMethod](`${timestamp} ${formatScope(scope)} ${payload.message}`, ...payload.data);
    return;
  }

  console[consoleMethod](`${timestamp} ${formatScope(scope)}`, ...payload.data);
}

function createLogger(scope) {
  return {
    debug: (...args) => write('debug', scope, args),
    info: (...args) => write('info', scope, args),
    warn: (...args) => write('warn', scope, args),
    error: (...args) => write('error', scope, args),
    child: (childScope) => createLogger(`${scope}:${childScope}`),
    isLevelEnabled: (level) => shouldLog(level),
  };
}

const logger = createLogger('app');

module.exports = {
  LEVELS,
  createLogger,
  logger,
};
