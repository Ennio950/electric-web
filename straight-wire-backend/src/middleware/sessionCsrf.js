'use strict';

const { isOriginAllowed, resolveAllowedOrigins } = require('../config/httpSecurity');
const { extractCsrfToken, extractPortalCsrfCookie } = require('../utils/authTokens');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function requiresSessionCsrf(req) {
  return !SAFE_METHODS.has(String((req && req.method) || 'GET').toUpperCase())
    && req
    && req.authTokenSource === 'session_cookie';
}

function validateSessionCsrf(req, options = {}) {
  if (!requiresSessionCsrf(req)) {
    return { ok: true };
  }

  const allowedOrigins = options.allowedOrigins || resolveAllowedOrigins({
    isDevelopment: options.isDevelopment === true,
    explicitOrigins: options.explicitOrigins || process.env.CSRF_ALLOWED_ORIGINS || process.env.CORS_ALLOWED_ORIGINS,
  });

  const origin = req.get('origin') || '';
  if (origin && !isOriginAllowed(origin, allowedOrigins)) {
    return {
      ok: false,
      reason: 'origin',
      error: 'Origin is not allowed for this session.',
    };
  }

  const cookieToken = extractPortalCsrfCookie(req);
  const headerToken = extractCsrfToken(req);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return {
      ok: false,
      reason: 'token',
      error: 'A valid CSRF token is required.',
    };
  }

  return { ok: true };
}

module.exports = {
  requiresSessionCsrf,
  validateSessionCsrf,
};
