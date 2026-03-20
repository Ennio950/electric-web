'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isOriginAllowed,
  normalizeOrigin,
  resolveAllowedOrigins,
} = require('../src/config/httpSecurity');

test('normalizeOrigin collapses URLs to lower-case origins', () => {
  assert.equal(normalizeOrigin('HTTP://127.0.0.1:8081/path?q=1'), 'http://127.0.0.1:8081');
});

test('resolveAllowedOrigins includes app base and local dev origins', () => {
  const origins = resolveAllowedOrigins({
    appBaseUrl: 'https://portal.example.com/app',
    isDevelopment: true,
  });

  assert.ok(origins.includes('https://portal.example.com'));
  assert.ok(origins.includes('http://127.0.0.1:8081'));
  assert.ok(origins.includes('http://localhost:5173'));
});

test('isOriginAllowed only accepts configured origins', () => {
  const allowedOrigins = ['http://127.0.0.1:8081', 'https://portal.example.com'];

  assert.equal(isOriginAllowed('http://127.0.0.1:8081', allowedOrigins), true);
  assert.equal(isOriginAllowed('https://evil.example.com', allowedOrigins), false);
});

test('development origins allow ngrok tunnel hosts', () => {
  const allowedOrigins = resolveAllowedOrigins({
    isDevelopment: true,
  });

  assert.equal(isOriginAllowed('https://demo-tunnel.ngrok-free.dev', allowedOrigins), true);
  assert.equal(isOriginAllowed('https://demo-tunnel.ngrok.app', allowedOrigins), true);
  assert.equal(isOriginAllowed('https://evil.example.com', allowedOrigins), false);
});
