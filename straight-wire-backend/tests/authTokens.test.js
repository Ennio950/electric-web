'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PORTAL_CSRF_COOKIE,
  PORTAL_SESSION_COOKIE,
  buildPortalSessionCookieOptions,
  createCsrfToken,
  extractCsrfToken,
  extractPortalCsrfCookie,
  extractBearerToken,
  extractPortalSessionCookie,
  isRequestSecure,
  parseCookies,
} = require('../src/utils/authTokens');

function createReq({ headers = {}, hostname = '127.0.0.1', secure = false } = {}) {
  return {
    headers,
    hostname,
    secure,
    get(name) {
      const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === String(name).toLowerCase());
      return key ? headers[key] : undefined;
    },
  };
}

test('extractBearerToken reads Authorization header', () => {
  const req = createReq({
    headers: {
      authorization: 'Bearer abc.def.ghi',
    },
  });

  assert.equal(extractBearerToken(req), 'abc.def.ghi');
});

test('parseCookies and extractPortalSessionCookie read portal session cookie', () => {
  const req = createReq({
    headers: {
      cookie: `foo=bar; ${PORTAL_SESSION_COOKIE}=session-token-123; ${PORTAL_CSRF_COOKIE}=csrf-token-123; theme=dark`,
    },
  });

  assert.equal(parseCookies(req)[PORTAL_SESSION_COOKIE], 'session-token-123');
  assert.equal(extractPortalSessionCookie(req), 'session-token-123');
  assert.equal(extractPortalCsrfCookie(req), 'csrf-token-123');
});

test('extractCsrfToken reads the csrf header and createCsrfToken returns a value', () => {
  const req = createReq({
    headers: {
      'x-csrf-token': 'header-token',
    },
  });

  assert.equal(extractCsrfToken(req), 'header-token');
  assert.match(createCsrfToken(), /^[A-Za-z0-9_-]{20,}$/);
});

test('loopback requests are treated as secure for portal cookie options', () => {
  const req = createReq({
    hostname: '127.0.0.1',
  });

  assert.equal(isRequestSecure(req), true);
  assert.equal(buildPortalSessionCookieOptions(req).secure, true);
});
