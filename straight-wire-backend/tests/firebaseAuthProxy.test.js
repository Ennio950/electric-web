'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_FIREBASE_AUTH_PROXY_HOST,
  buildFirebaseProxyPath,
  resolveProxyHost,
  shouldProxyFirebaseAuthPath,
} = require('../src/middleware/firebaseAuthProxy');

test('shouldProxyFirebaseAuthPath only matches Firebase helper paths', () => {
  assert.equal(shouldProxyFirebaseAuthPath('/__/auth'), true);
  assert.equal(shouldProxyFirebaseAuthPath('/__/auth/iframe'), true);
  assert.equal(shouldProxyFirebaseAuthPath('/__/firebase/init.json'), true);
  assert.equal(shouldProxyFirebaseAuthPath('/auth/google'), false);
});

test('buildFirebaseProxyPath preserves helper queries', () => {
  assert.equal(
    buildFirebaseProxyPath('/__/auth/iframe?apiKey=test-key&appName=sw'),
    '/__/auth/iframe?apiKey=test-key&appName=sw',
  );
});

test('resolveProxyHost falls back to the managed Firebase host', () => {
  assert.equal(resolveProxyHost(''), DEFAULT_FIREBASE_AUTH_PROXY_HOST);
  assert.equal(resolveProxyHost('  Demo.Example.com  '), 'demo.example.com');
});
