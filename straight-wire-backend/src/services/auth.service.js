'use strict';

// Firebase Auth helpers for issuing custom tokens (no email/password sign-in).

const fs = require('fs');
const path = require('path');

const { admin, auth } = require('../firebase');
const { getBackendRoot } = require('../config/env');
const { appError } = require('../utils/errors');

function getFirebaseApiKey() {
  const key =
    process.env.FIREBASE_API_KEY ||
    process.env.FIREBASE_WEB_API_KEY ||
    process.env.FIREBASE_CLIENT_API_KEY ||
    null;

  return typeof key === 'string' && key.trim() !== '' ? key.trim() : null;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function resolveCredentialsPath(credentialsPath) {
  if (!credentialsPath) return null;
  return path.isAbsolute(credentialsPath) ? credentialsPath : path.resolve(getBackendRoot(), credentialsPath);
}

function isIamCredentialsApiDisabledError(err) {
  const code = err && (err.code || (err.errorInfo && err.errorInfo.code));
  const message = err && typeof err.message === 'string' ? err.message : '';

  return (
    code === 'auth/insufficient-permission' &&
    (message.includes('iamcredentials.googleapis.com') ||
      message.includes('IAM Service Account Credentials API has not been used'))
  );
}

function getCertSignerAuth() {
  // When Firebase Admin is initialized with ADC, createCustomToken may rely on
  // IAM Service Account Credentials API (iamcredentials.googleapis.com) to sign tokens.
  // In local development, it's common to use a service account JSON key file, which can
  // sign custom tokens locally (no IAM API needed).
  //
  // This helper creates (or reuses) a dedicated app using `credential.cert(...)` ONLY
  // for minting custom tokens, keeping the rest of the backend on ADC.

  const appName = 'customTokenSigner';
  if (getCertSignerAuth._cachedAuth) return getCertSignerAuth._cachedAuth;

  const existing = admin.apps.find((app) => app.name === appName);
  if (existing) {
    getCertSignerAuth._cachedAuth = existing.auth();
    return getCertSignerAuth._cachedAuth;
  }

  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const resolvedPath = resolveCredentialsPath(credentialsEnv);
  if (!resolvedPath) return null;
  if (!fs.existsSync(resolvedPath)) return null;

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (err) {
    console.error('[auth] Failed to read GOOGLE_APPLICATION_CREDENTIALS JSON file:', err);
    return null;
  }

  try {
    const app = admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
      },
      appName,
    );
    getCertSignerAuth._cachedAuth = app.auth();
    return getCertSignerAuth._cachedAuth;
  } catch (err) {
    // If another request initialized the app concurrently, reuse it.
    const concurrent = admin.apps.find((app) => app.name === appName);
    if (concurrent) {
      getCertSignerAuth._cachedAuth = concurrent.auth();
      return getCertSignerAuth._cachedAuth;
    }

    console.error('[auth] Failed to initialize custom token signer app:', err);
    return null;
  }
}

async function createCustomToken(uid, additionalClaims) {
  if (!isNonEmptyString(uid)) {
    throw appError(400, 'invalid_payload', 'uid is required.');
  }

  try {
    return await auth.createCustomToken(uid, additionalClaims);
  } catch (err) {
    if (!isIamCredentialsApiDisabledError(err)) throw err;

    const signerAuth = getCertSignerAuth();
    if (!signerAuth) throw err;

    return signerAuth.createCustomToken(uid, additionalClaims);
  }
}

async function signInWithCustomToken(customToken) {
  if (!isNonEmptyString(customToken)) {
    throw appError(400, 'invalid_payload', 'custom token is required.');
  }

  const apiKey = getFirebaseApiKey();
  if (!apiKey) {
    console.error('[auth] Missing FIREBASE_API_KEY (or FIREBASE_WEB_API_KEY) environment variable.');
    throw appError(500, 'server_misconfigured', 'Server authentication is not configured.');
  }

  const url =
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' +
    encodeURIComponent(apiKey);

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: String(customToken),
      returnSecureToken: true,
    }),
  });

  let data;
  try {
    data = await resp.json();
  } catch (err) {
    console.error('[auth] Failed to parse Identity Toolkit response:', err);
    throw appError(500, 'auth_error', 'Authentication service error.');
  }

  if (!resp.ok) {
    const message =
      data && data.error && typeof data.error.message === 'string'
        ? data.error.message
        : 'UNKNOWN';

    // Docs: https://firebase.google.com/docs/reference/rest/auth#section-sign-in-custom-token
    switch (message) {
      case 'INVALID_CUSTOM_TOKEN':
      case 'CREDENTIAL_MISMATCH':
      case 'MISSING_CUSTOM_TOKEN':
        throw appError(500, 'auth_error', 'Authentication service error.');
      default:
        throw appError(500, 'auth_error', 'Authentication service error.');
    }
  }

  // Response shape:
  // https://firebase.google.com/docs/reference/rest/auth#section-sign-in-custom-token
  if (!data || !isNonEmptyString(data.idToken)) {
    console.error('[auth] Unexpected Identity Toolkit response (signInWithCustomToken):', {
      kind: data && data.kind ? data.kind : null,
      hasIdToken: Boolean(data && isNonEmptyString(data.idToken)),
      hasRefreshToken: Boolean(data && isNonEmptyString(data.refreshToken)),
      hasExpiresIn: Boolean(data && isNonEmptyString(data.expiresIn)),
    });
    throw appError(500, 'auth_error', 'Authentication service error.');
  }

  return {
    idToken: data.idToken,
    uid: isNonEmptyString(data.localId) ? data.localId : null,
    email: isNonEmptyString(data.email) ? data.email.trim() : null,
  };
}

module.exports = {
  createCustomToken,
  signInWithCustomToken,
};
