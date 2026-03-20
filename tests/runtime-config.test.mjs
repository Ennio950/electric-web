import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeBaseUrl,
  resolveApiBaseFromLocation,
} from '../assets/js/runtime-config.js';

test('normalizeBaseUrl trims trailing slash', () => {
  assert.equal(normalizeBaseUrl('http://127.0.0.1:8081/'), 'http://127.0.0.1:8081');
});

test('resolveApiBaseFromLocation uses backend fallback for legacy localhost ports', () => {
  const apiBase = resolveApiBaseFromLocation({
    location: {
      hostname: '127.0.0.1',
      port: '5500',
      protocol: 'http:',
      origin: 'http://127.0.0.1:5500',
    },
  });

  assert.equal(apiBase, 'http://127.0.0.1:8081');
});

test('resolveApiBaseFromLocation prefers same-origin outside legacy ports', () => {
  const apiBase = resolveApiBaseFromLocation({
    location: {
      hostname: '127.0.0.1',
      port: '8081',
      protocol: 'http:',
      origin: 'http://127.0.0.1:8081',
    },
  });

  assert.equal(apiBase, 'http://127.0.0.1:8081');
});

