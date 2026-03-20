'use strict';

// Centralized Firebase Admin SDK bootstrap.
// - Uses Application Default Credentials (ADC)
// - Prevents duplicate initialization across imports
// - Exports ready-to-use admin, db (Firestore) and auth instances

const fs = require('fs');
const path = require('path');

const admin = require('firebase-admin');
const { getBackendRoot, loadBackendEnv } = require('./config/env');

loadBackendEnv();

function resolveCredentialsPath(credentialsPath) {
  if (!credentialsPath) return null;
  return path.isAbsolute(credentialsPath) ? credentialsPath : path.resolve(getBackendRoot(), credentialsPath);
}

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) return admin.app();

  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const resolvedCredentialsPath = resolveCredentialsPath(credentialsEnv);

  if (resolvedCredentialsPath && !fs.existsSync(resolvedCredentialsPath)) {
    console.error('[firebase] GOOGLE_APPLICATION_CREDENTIALS points to a missing file.');
    console.error(`[firebase] Provided: ${credentialsEnv}`);
    console.error(`[firebase] Resolved: ${resolvedCredentialsPath}`);
    console.error('[firebase] Create the service account JSON file or update GOOGLE_APPLICATION_CREDENTIALS.');
    throw new Error('Firebase Admin SDK initialization failed: missing credentials file.');
  }

  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    return admin.app();
  } catch (err) {
    console.error('[firebase] Failed to initialize Firebase Admin SDK using Application Default Credentials.');
    console.error(
      '[firebase] Provide credentials via GOOGLE_APPLICATION_CREDENTIALS or configure ADC (e.g., gcloud auth application-default login).',
    );
    console.error('[firebase] Original error:', err);
    throw err;
  }
}

initializeFirebaseAdmin();

const db = admin.firestore();
const auth = admin.auth();

module.exports = {
  admin,
  db,
  auth,
};
