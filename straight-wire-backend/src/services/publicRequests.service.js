'use strict';

// Public (no-login) client request flow.
//
// Goals:
// - Create or reuse a Firebase Auth user by email (no password).
// - Ensure role "client" is assigned (custom claims + users/{uid} doc).
// - Mint an ID token usable by the frontend for /client/* endpoints.
// - Create a Firestore job/request under the client.

const { auth, db } = require('../firebase');
const { appError } = require('../utils/errors');

const { assignUserRole } = require('./roles.service');
const { createCustomToken, signInWithCustomToken } = require('./auth.service');
const { createJobForClient } = require('./jobs.service');

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isKnownRole(role) {
  return role === 'boss' || role === 'employee' || role === 'client';
}

async function readRoleFromFirestore(uid) {
  try {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const role = data && typeof data.role === 'string' ? data.role.trim() : '';
    return role ? role : null;
  } catch (err) {
    console.error('[public] Failed to read user role from Firestore:', err);
    return null;
  }
}

async function getExistingRole(userRecord) {
  const claims = userRecord && userRecord.customClaims && typeof userRecord.customClaims === 'object'
    ? userRecord.customClaims
    : null;

  const claimRole = claims && typeof claims.role === 'string' ? claims.role.trim() : '';
  if (claimRole && isKnownRole(claimRole)) return claimRole;

  return readRoleFromFirestore(userRecord.uid);
}

async function getOrCreateUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!isNonEmptyString(normalizedEmail)) {
    throw appError(400, 'invalid_payload', 'email is required.');
  }

  try {
    const userRecord = await auth.getUserByEmail(normalizedEmail);
    return { userRecord, created: false };
  } catch (err) {
    if (err && err.code === 'auth/user-not-found') {
      // Create user WITHOUT password.
      const userRecord = await auth.createUser({ email: normalizedEmail });
      return { userRecord, created: true };
    }

    console.error('[public] Failed to lookup user by email:', err);
    throw appError(500, 'internal_error', 'Internal Server Error');
  }
}

function toISOString(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

async function createPublicClientRequest(input) {
  if (!input || typeof input !== 'object') {
    throw appError(400, 'invalid_payload', 'Invalid payload.');
  }

  const email = input.email;
  const description = input.description;
  const address = input.address;
  const priority = input.priority;
  const photos = input.photos;

  if (!isNonEmptyString(email)) throw appError(400, 'invalid_payload', 'email is required.');
  if (!isNonEmptyString(description)) throw appError(400, 'invalid_payload', 'description is required.');
  if (!isNonEmptyString(address)) throw appError(400, 'invalid_payload', 'address is required.');
  if (!isNonEmptyString(priority)) throw appError(400, 'invalid_payload', 'priority is required.');

  const normalizedEmail = normalizeEmail(email);

  let userRecord;
  try {
    const result = await getOrCreateUserByEmail(normalizedEmail);
    userRecord = result.userRecord;
  } catch (err) {
    if (err && typeof err.status === 'number') throw err;
    throw appError(500, 'internal_error', 'Internal Server Error');
  }

  const existingRole = await getExistingRole(userRecord);
  if (existingRole && existingRole !== 'client') {
    throw appError(400, 'invalid_payload', 'Email belongs to a non-client account.');
  }

  // Ensure role is "client" (idempotent if already client).
  try {
    await assignUserRole(userRecord.uid, 'client');
  } catch (err) {
    console.error('[public] Failed to assign client role:', err);
    throw appError(500, 'internal_error', 'Internal Server Error');
  }

  // Mint an ID token via custom token exchange (no Firebase SDK required on the frontend).
  let idToken;
  try {
    const customToken = await createCustomToken(userRecord.uid);
    const signIn = await signInWithCustomToken(customToken);
    idToken = signIn.idToken;
  } catch (err) {
    console.error('[public] Failed to mint ID token:', err);
    throw appError(500, 'internal_error', 'Internal Server Error');
  }

  // Create the job/request under this client.
  let job;
  try {
    job = await createJobForClient(userRecord.uid, {
      email: normalizedEmail,
      description: description.trim(),
      address: address.trim(),
      priority: String(priority).trim(),
      photos: Array.isArray(photos) ? photos : undefined,
    });
  } catch (err) {
    console.error('[public] Failed to create job:', err);
    throw appError(500, 'internal_error', 'Internal Server Error');
  }

  return {
    token: idToken,
    role: 'client',
    job: {
      id: job.id,
      status: job.status,
      createdAt: toISOString(job.createdAt) || new Date().toISOString(),
    },
  };
}

module.exports = {
  createPublicClientRequest,
};
