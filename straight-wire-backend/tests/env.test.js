'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { getBackendRoot, resolveEnvFiles } = require('../src/config/env');

test('resolveEnvFiles prioritizes local overrides', () => {
  const root = path.resolve(__dirname, '..');
  const files = resolveEnvFiles(root);

  assert.deepEqual(files, [
    path.join(root, '.env.local'),
    path.join(root, '.env'),
  ]);
});

test('getBackendRoot resolves to backend package root', () => {
  const root = getBackendRoot();
  assert.equal(path.basename(root), 'straight-wire-backend');
});

