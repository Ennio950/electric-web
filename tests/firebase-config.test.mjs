import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_FIREBASE_AUTH_DOMAIN,
  isTemporaryPublicHost,
  resolveFirebaseAuthDomain,
  shouldUseSameHostFirebaseAuth,
} from '../assets/js/firebase-config.js';

test('public hosts use the current host as Firebase authDomain', () => {
  const locationLike = {
    host: 'portal.example.com',
    hostname: 'portal.example.com',
  };

  assert.equal(shouldUseSameHostFirebaseAuth(locationLike), true);
  assert.equal(resolveFirebaseAuthDomain(locationLike), 'portal.example.com');
});

test('localhost keeps the managed Firebase authDomain fallback', () => {
  const locationLike = {
    host: '127.0.0.1:8081',
    hostname: '127.0.0.1',
  };

  assert.equal(shouldUseSameHostFirebaseAuth(locationLike), false);
  assert.equal(resolveFirebaseAuthDomain(locationLike), DEFAULT_FIREBASE_AUTH_DOMAIN);
});

test('temporary tunnel hosts keep the managed Firebase authDomain fallback', () => {
  const locationLike = {
    host: 'unsurfeiting-mckinley-nesty.ngrok-free.dev',
    hostname: 'unsurfeiting-mckinley-nesty.ngrok-free.dev',
  };

  assert.equal(isTemporaryPublicHost(locationLike.hostname), true);
  assert.equal(shouldUseSameHostFirebaseAuth(locationLike), false);
  assert.equal(resolveFirebaseAuthDomain(locationLike), DEFAULT_FIREBASE_AUTH_DOMAIN);
});
