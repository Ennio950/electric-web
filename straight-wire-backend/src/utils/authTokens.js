'use strict';

const crypto = require('crypto');

const PORTAL_SESSION_COOKIE = 'swe_portal_session';
const PORTAL_CSRF_COOKIE = 'swe_portal_csrf';
const PORTAL_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeHeaderValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function extractBearerToken(req) {
  const raw = normalizeHeaderValue(req.get('Authorization') || req.get('authorization'));
  if (!raw) return null;

  const prefix = 'bearer ';
  if (raw.length <= prefix.length) return null;
  if (raw.slice(0, prefix.length).toLowerCase() !== prefix) return null;

  const token = raw.slice(prefix.length).trim();
  return token || null;
}

function parseCookies(req) {
  const cookieHeader = normalizeHeaderValue(req.headers && req.headers.cookie);
  if (!cookieHeader) return {};

  return cookieHeader.split(';').reduce((acc, part) => {
    const index = part.indexOf('=');
    if (index <= 0) return acc;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) return acc;

    try {
      acc[key] = decodeURIComponent(value);
    } catch (_) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function extractPortalSessionCookie(req) {
  const cookies = parseCookies(req);
  const token = normalizeHeaderValue(cookies[PORTAL_SESSION_COOKIE]);
  return token || null;
}

function extractPortalCsrfCookie(req) {
  const cookies = parseCookies(req);
  const token = normalizeHeaderValue(cookies[PORTAL_CSRF_COOKIE]);
  return token || null;
}

function extractCsrfToken(req) {
  return normalizeHeaderValue(req.get('x-csrf-token') || req.get('x-xsrf-token')) || null;
}

function isLoopbackHost(hostname) {
  const normalized = normalizeHeaderValue(hostname).toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function isRequestSecure(req) {
  if (req && req.secure) return true;

  const forwardedProto = normalizeHeaderValue(req.get('x-forwarded-proto'));
  if (forwardedProto.toLowerCase().split(',').map((value) => value.trim()).includes('https')) {
    return true;
  }

  const host = normalizeHeaderValue(req.hostname || req.get('host')).split(':')[0];
  return isLoopbackHost(host);
}

function buildPortalSessionCookieOptions(req, overrides = {}) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isRequestSecure(req),
    path: '/',
    maxAge: PORTAL_SESSION_MAX_AGE_MS,
    ...overrides,
  };
}

function buildPortalCsrfCookieOptions(req, overrides = {}) {
  return {
    httpOnly: false,
    sameSite: 'lax',
    secure: isRequestSecure(req),
    path: '/',
    maxAge: PORTAL_SESSION_MAX_AGE_MS,
    ...overrides,
  };
}

function createCsrfToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function clearPortalSessionCookie(res, req) {
  res.cookie(
    PORTAL_SESSION_COOKIE,
    '',
    buildPortalSessionCookieOptions(req, {
      maxAge: 0,
      expires: new Date(0),
    }),
  );
}

function clearPortalCsrfCookie(res, req) {
  res.cookie(
    PORTAL_CSRF_COOKIE,
    '',
    buildPortalCsrfCookieOptions(req, {
      maxAge: 0,
      expires: new Date(0),
    }),
  );
}

module.exports = {
  PORTAL_CSRF_COOKIE,
  PORTAL_SESSION_COOKIE,
  PORTAL_SESSION_MAX_AGE_MS,
  buildPortalCsrfCookieOptions,
  buildPortalSessionCookieOptions,
  clearPortalSessionCookie,
  clearPortalCsrfCookie,
  createCsrfToken,
  extractBearerToken,
  extractCsrfToken,
  extractPortalCsrfCookie,
  extractPortalSessionCookie,
  isRequestSecure,
  parseCookies,
};
