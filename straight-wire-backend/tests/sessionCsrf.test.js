'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { validateSessionCsrf } = require('../src/middleware/sessionCsrf');

function createRequest({ method = 'POST', authTokenSource = 'session_cookie', headers = {} } = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value]),
  );

  return {
    method,
    authTokenSource,
    headers: normalizedHeaders,
    get(name) {
      return normalizedHeaders[String(name).toLowerCase()] || '';
    },
  };
}

test('validateSessionCsrf allows safe methods without a token', () => {
  const result = validateSessionCsrf(createRequest({ method: 'GET' }));
  assert.deepEqual(result, { ok: true });
});

test('validateSessionCsrf rejects session-cookie mutations without matching token', () => {
  const result = validateSessionCsrf(createRequest({
    headers: {
      cookie: 'swe_portal_csrf=abc123',
    },
  }));

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'token');
});

test('validateSessionCsrf accepts matching token and allowed origin', () => {
  const result = validateSessionCsrf(createRequest({
    headers: {
      cookie: 'swe_portal_csrf=abc123',
      origin: 'http://127.0.0.1:5173',
      'x-csrf-token': 'abc123',
    },
  }), {
    allowedOrigins: ['http://127.0.0.1:5173'],
  });

  assert.deepEqual(result, { ok: true });
});

test('validateSessionCsrf rejects disallowed origins', () => {
  const result = validateSessionCsrf(createRequest({
    headers: {
      cookie: 'swe_portal_csrf=abc123',
      origin: 'https://evil.example.com',
      'x-csrf-token': 'abc123',
    },
  }), {
    allowedOrigins: ['http://127.0.0.1:5173'],
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'origin');
});

test('validateSessionCsrf accepts ngrok origins during development', () => {
  const result = validateSessionCsrf(createRequest({
    headers: {
      cookie: 'swe_portal_csrf=abc123',
      origin: 'https://preview-link.ngrok-free.dev',
      'x-csrf-token': 'abc123',
    },
  }), {
    isDevelopment: true,
  });

  assert.deepEqual(result, { ok: true });
});
