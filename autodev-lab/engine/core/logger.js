const fs = require('fs');
const path = require('path');

function toSafeSegment(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function serializeMeta(meta) {
  if (meta === undefined) {
    return '';
  }

  try {
    return ` ${JSON.stringify(meta)}`;
  } catch (error) {
    return ` {"metaError":"${error.message}"}`;
  }
}

class Logger {
  constructor({ nombreMotor = 'autodev', logsDir }) {
    if (!logsDir) {
      throw new Error('Logger requires a logsDir value.');
    }

    fs.mkdirSync(logsDir, { recursive: true });

    this.nombreMotor = nombreMotor;
    this.logsDir = logsDir;
    this.closed = false;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${toSafeSegment(nombreMotor)}-${timestamp}-${process.pid}.log`;

    this.logFilePath = path.join(logsDir, fileName);
    this.stream = fs.createWriteStream(this.logFilePath, {
      flags: 'a',
      encoding: 'utf8',
    });
  }

  log(level, message, meta) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${String(level).toUpperCase()}] ${message}${serializeMeta(meta)}`;
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';

    console[consoleMethod](line);

    if (!this.closed) {
      this.stream.write(`${line}\n`);
    }

    return line;
  }

  info(message, meta) {
    return this.log('info', message, meta);
  }

  warn(message, meta) {
    return this.log('warn', message, meta);
  }

  error(message, meta) {
    return this.log('error', message, meta);
  }

  debug(message, meta) {
    return this.log('debug', message, meta);
  }

  close() {
    if (this.closed) {
      return Promise.resolve();
    }

    this.closed = true;

    return new Promise((resolve) => {
      this.stream.end(resolve);
    });
  }
}

function createLogger(options) {
  return new Logger(options);
}

module.exports = {
  Logger,
  createLogger,
};
