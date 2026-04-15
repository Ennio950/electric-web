'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildCspDirectives, splitSources } = require('../src/config/security');

test('splitSources accepts whitespace and commas', () => {
  assert.deepEqual(splitSources('https://a.test, https://b.test  ws://c.test'), [
    'https://a.test',
    'https://b.test',
    'ws://c.test',
  ]);
});

test('buildCspDirectives includes self and development connect sources', () => {
  const directives = buildCspDirectives({ isDevelopment: true });

  assert.ok(directives.defaultSrc.includes("'self'"));
  assert.ok(directives.scriptSrc.includes('https://apis.google.com'));
  assert.ok(directives.connectSrc.includes('http://127.0.0.1:5174'));
  assert.ok(!directives.scriptSrc.includes('https://www.gstatic.com'));
  assert.ok(!directives.styleSrc.includes('https://fonts.googleapis.com'));
});

test('buildCspDirectives supports nonce-based script blocks while blocking inline script attributes', () => {
  const directives = buildCspDirectives({ nonce: 'abc123' });

  assert.ok(directives.scriptSrc.includes("'nonce-abc123'"));
  assert.ok(directives.scriptSrcAttr.includes("'none'"));
  assert.ok(directives.styleSrc.includes("'unsafe-inline'"));
  assert.ok(directives.frameSrc.includes('https://*.firebaseapp.com'));
});
