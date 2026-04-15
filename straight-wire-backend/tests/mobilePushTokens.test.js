'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hashPushToken,
  normalizePushPlatform,
  normalizePushTokenParam,
  normalizeRegisterPushTokenPayload,
} = require('../src/utils/mobilePushTokens');

test('normalizeRegisterPushTokenPayload trims and validates mobile push token payload', () => {
  const payload = normalizeRegisterPushTokenPayload({
    token: '  ExponentPushToken[abc123]  ',
    platform: ' IOS ',
    appVersion: ' 1.2.3 ',
    deviceId: '  device-42 ',
  });

  assert.deepEqual(payload, {
    token: 'ExponentPushToken[abc123]',
    platform: 'ios',
    appVersion: '1.2.3',
    deviceId: 'device-42',
  });
});

test('normalizePushPlatform rejects unsupported values', () => {
  assert.equal(normalizePushPlatform('android'), 'android');
  assert.equal(normalizePushPlatform('web'), '');
  assert.equal(normalizePushPlatform(''), '');
});

test('normalizePushTokenParam decodes route-safe tokens', () => {
  const encoded = encodeURIComponent('ExponentPushToken[abc123]');
  assert.equal(normalizePushTokenParam(encoded), 'ExponentPushToken[abc123]');
});

test('hashPushToken is stable for the same token', () => {
  const token = 'ExponentPushToken[abc123]';
  assert.equal(hashPushToken(token), hashPushToken(token));
  assert.notEqual(hashPushToken(token), hashPushToken('ExponentPushToken[xyz789]'));
});
