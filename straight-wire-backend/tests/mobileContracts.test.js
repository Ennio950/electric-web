'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_MOBILE_FEATURE_FLAGS,
  buildMobileBootstrapResponse,
  buildMobileCompanyConfig,
  normalizeMobilePhotoPolicy,
} = require('../src/utils/mobileContracts');

test('buildMobileCompanyConfig returns stable defaults', () => {
  const config = buildMobileCompanyConfig();

  assert.equal(config.companyName, 'Straight Wire Electric');
  assert.equal(config.timezone, 'America/Guatemala');
  assert.equal(config.locale, 'es-GT');
  assert.equal(config.currency, 'GTQ');
  assert.equal(config.logoUrl, 'assets/images/logo.webp');
  assert.equal(config.supportPhone, '3236142546');
  assert.equal(config.whatsappNumber, null);
  assert.deepEqual(config.photoPolicy.allowedMimeTypes, ['image/jpeg', 'image/png', 'image/webp']);
});

test('buildMobileCompanyConfig maps persisted company fields to mobile contract', () => {
  const config = buildMobileCompanyConfig({
    displayName: 'Electric Pro',
    phone: '+50212345678',
    whatsappNumber: '+50287654321',
    timezone: 'America/Mexico_City',
    locale: 'es_MX',
    currency: 'mxn',
    logoUrl: 'https://cdn.example.com/logo.png',
    photoPolicy: {
      maxUploadBytes: 500000,
      maxImageDimension: 1200,
      compressionTargetBytes: 350000,
      allowedMimeTypes: ['image/png', 'image/webp'],
    },
  });

  assert.equal(config.companyName, 'Electric Pro');
  assert.equal(config.supportPhone, '+50212345678');
  assert.equal(config.whatsappNumber, '+50287654321');
  assert.equal(config.timezone, 'America/Mexico_City');
  assert.equal(config.locale, 'es-MX');
  assert.equal(config.currency, 'MXN');
  assert.equal(config.logoUrl, 'https://cdn.example.com/logo.png');
  assert.deepEqual(config.photoPolicy, {
    maxUploadBytes: 500000,
    maxImageDimension: 1200,
    compressionTargetBytes: 350000,
    allowedMimeTypes: ['image/png', 'image/webp'],
  });
});

test('normalizeMobilePhotoPolicy falls back when values are invalid', () => {
  const policy = normalizeMobilePhotoPolicy({
    maxUploadBytes: -1,
    maxImageDimension: 0,
    compressionTargetBytes: 'bad',
    allowedMimeTypes: ['image/gif', 'image/png', 'image/png'],
  });

  assert.equal(policy.maxUploadBytes, 1024 * 1024);
  assert.equal(policy.maxImageDimension, 1600);
  assert.equal(policy.compressionTargetBytes, 1024 * 1024);
  assert.deepEqual(policy.allowedMimeTypes, ['image/png']);
});

test('buildMobileBootstrapResponse returns the locked mobile shape', () => {
  const payload = buildMobileBootstrapResponse({
    user: {
      uid: 'boss-123',
      email: 'boss@example.com',
      name: 'Boss User',
    },
    role: 'boss',
    companyConfig: {
      displayName: 'Electric HQ',
      phone: '555-0100',
    },
  });

  assert.deepEqual(payload, {
    user: {
      uid: 'boss-123',
      email: 'boss@example.com',
      displayName: 'Boss User',
    },
    role: 'boss',
    featureFlags: { ...DEFAULT_MOBILE_FEATURE_FLAGS },
    companyConfig: {
      companyName: 'Electric HQ',
      timezone: 'America/Guatemala',
      locale: 'es-GT',
      currency: 'GTQ',
      logoUrl: 'assets/images/logo.webp',
      supportPhone: '555-0100',
      whatsappNumber: null,
      photoPolicy: {
        maxUploadBytes: 1024 * 1024,
        maxImageDimension: 1600,
        compressionTargetBytes: 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      },
    },
  });
});
