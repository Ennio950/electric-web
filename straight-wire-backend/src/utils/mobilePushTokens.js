'use strict';

const crypto = require('crypto');

const PUSH_PLATFORMS = new Set(['ios', 'android']);

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePushPlatform(value) {
  const platform = cleanString(value).toLowerCase();
  return PUSH_PLATFORMS.has(platform) ? platform : '';
}

function normalizeRegisterPushTokenPayload(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  return {
    token: cleanString(source.token),
    platform: normalizePushPlatform(source.platform),
    appVersion: cleanString(source.appVersion),
    deviceId: cleanString(source.deviceId),
  };
}

function normalizePushTokenParam(value) {
  try {
    return cleanString(decodeURIComponent(String(value || '')));
  } catch (_) {
    return cleanString(value);
  }
}

function hashPushToken(token) {
  return crypto.createHash('sha256').update(cleanString(token)).digest('hex');
}

module.exports = {
  normalizePushPlatform,
  normalizeRegisterPushTokenPayload,
  normalizePushTokenParam,
  hashPushToken,
};
