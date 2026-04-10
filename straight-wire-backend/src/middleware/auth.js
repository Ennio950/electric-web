'use strict';

// Firebase Authentication middleware (backend authority).
// - Reads Authorization: Bearer <firebase_id_token>
// - Verifies the token using Firebase Admin SDK (server-side)
// - Attaches the decoded token to req.user for downstream handlers
// - Logs missing/invalid tokens only in development

const { createLogger } = require('../utils/logger');
const { verifyRequestAuth } = require('../services/requestAuth.service');
const { validateSessionCsrf } = require('./sessionCsrf');

const logger = createLogger('auth');

const DEFAULT_ERROR_STYLE = 'legacy';

function isDev() {
  return process.env.NODE_ENV !== 'production';
}

function sendLegacy(res, status, code, message) {
  return res.status(status).json({
    ok: false,
    error: {
      code,
      message,
    },
  });
}

function sendFlat(res, status, code, message) {
  return res.status(status).json({
    ok: false,
    error: code,
    message,
  });
}

function sendError(res, status, code, message, style) {
  if (style === 'flat') return sendFlat(res, status, code, message);
  return sendLegacy(res, status, code, message);
}

function createAuthMiddleware(options = {}) {
  const errorStyle = options.errorStyle || DEFAULT_ERROR_STYLE;

  return async function authMiddleware(req, res, next) {
    let verified;
    try {
      verified = await verifyRequestAuth(req, {
        allowSessionCookie: true,
        checkRevoked: true,
      });
    } catch (err) {
      if (isDev()) logger.warn('Token verification failed:', err && err.code ? err.code : err);
      const code = errorStyle === 'flat' ? 'invalid_token' : 'INVALID_TOKEN';
      return sendError(res, 401, code, 'Invalid or expired token.', errorStyle);
    }

    if (!verified) {
      if (isDev()) logger.warn('Missing Authorization header or session cookie.');
      const code = errorStyle === 'flat' ? 'unauthorized' : 'UNAUTHENTICATED';
      return sendError(res, 401, code, 'Missing or invalid Authorization header.', errorStyle);
    }

    const decodedToken = verified.decoded;
    if (!decodedToken || !decodedToken.uid) {
      if (isDev()) logger.warn('Decoded token missing uid.');
      const code = errorStyle === 'flat' ? 'invalid_token' : 'INVALID_TOKEN';
      return sendError(res, 401, code, 'Invalid or expired token.', errorStyle);
    }

    // Normalize common fields while preserving the decoded token shape.
    if (typeof decodedToken.email === 'string') {
      decodedToken.email = decodedToken.email.trim();
    }
    if (typeof decodedToken.role === 'string') {
      decodedToken.role = decodedToken.role.trim();
    }

    req.user = decodedToken;
    req.authTokenSource = verified.source;
    req.authTokenRaw = verified.rawToken;

    const csrfCheck = validateSessionCsrf(req, {
      isDevelopment: process.env.NODE_ENV !== 'production',
    });
    if (!csrfCheck.ok) {
      const code = errorStyle === 'flat' ? 'csrf_invalid' : 'CSRF_INVALID';
      return sendError(res, 403, code, csrfCheck.error, errorStyle);
    }

    return next();
  };
}

const authMiddleware = createAuthMiddleware();
authMiddleware.withOptions = (options) => createAuthMiddleware(options);
authMiddleware.flat = createAuthMiddleware({ errorStyle: 'flat' });

module.exports = authMiddleware;
