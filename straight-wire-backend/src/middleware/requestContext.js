'use strict';

const crypto = require('crypto');

const { createLogger } = require('../utils/logger');

const logger = createLogger('http');

function normalizeRequestId(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  return /^[A-Za-z0-9._:-]{8,128}$/.test(raw) ? raw : '';
}

function attachRequestContext(req, res, next) {
  const requestId = normalizeRequestId(req.get('x-request-id')) || crypto.randomUUID();

  req.requestId = requestId;
  req.log = logger.child(requestId);
  res.locals.requestId = requestId;
  res.set('X-Request-Id', requestId);

  next();
}

function logRequests(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    if (!logger.isLevelEnabled('info')) return;

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.info('request.complete', {
      requestId: req.requestId || null,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
      origin: req.get('origin') || null,
      authSource: req.authTokenSource || null,
    });
  });

  next();
}

module.exports = {
  attachRequestContext,
  logRequests,
};
