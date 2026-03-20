'use strict';

// Magic link + OTP authentication (dev-ready).
//
// Collection: magicChallenges/{challengeId}
// {
//   email,
//   uid,
//   codeHash,
//   attempts: 0,
//   createdAt,
//   expiresAt: now + 10 min,
//   used: false
// }
//
// In dev, we DO NOT send email. We log:
//   [magic] email=... code=123456 link=...

const crypto = require('crypto');

const { admin, auth, db } = require('../firebase');
const { appError } = require('../utils/errors');
const { createLogger } = require('../utils/logger');

const { assignUserRole } = require('./roles.service');
const logger = createLogger('magic');

const COLLECTION = 'magicChallenges';
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isKnownRole(role) {
  return role === 'boss' || role === 'employee' || role === 'client';
}

function buildMagicLink(challengeId, email) {
  const base = isNonEmptyString(process.env.APP_BASE_URL)
    ? process.env.APP_BASE_URL.trim().replace(/\/+$/, '')
    : 'http://127.0.0.1:8081';

  return (
    base +
    '/cliente-otp.html?challengeId=' +
    encodeURIComponent(challengeId) +
    '&email=' +
    encodeURIComponent(email)
  );
}

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashCode(code, salt) {
  // SHA256(code + salt) is sufficient for an OTP stored short-term with limited attempts.
  return crypto.createHash('sha256').update(String(code) + String(salt)).digest('hex');
}

function timingSafeEqualHex(a, b) {
  if (!isNonEmptyString(a) || !isNonEmptyString(b)) return false;

  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;

  return crypto.timingSafeEqual(bufA, bufB);
}

async function getOrCreateUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!isNonEmptyString(normalizedEmail)) throw appError(400, 'invalid_payload', 'email is required.');

  try {
    const userRecord = await auth.getUserByEmail(normalizedEmail);
    return { userRecord, created: false };
  } catch (err) {
    if (err && err.code === 'auth/user-not-found') {
      const userRecord = await auth.createUser({ email: normalizedEmail });
      return { userRecord, created: true };
    }

    logger.error('Failed to lookup user by email:', err);
    throw appError(500, 'internal_error', 'Internal Server Error');
  }
}

async function ensureClientRole(userRecord) {
  const claims =
    userRecord && userRecord.customClaims && typeof userRecord.customClaims === 'object'
      ? userRecord.customClaims
      : null;

  const existingRole = claims && typeof claims.role === 'string' ? claims.role.trim() : '';
  let firestoreRole = '';
  try {
    const snap = await db.collection('users').doc(userRecord.uid).get();
    if (snap.exists) {
      const data = snap.data() || {};
      firestoreRole = typeof data.role === 'string' ? data.role.trim() : '';
    }
  } catch (err) {
    logger.error('Failed to read Firestore role:', err);
  }

  const effectiveRoles = [existingRole, firestoreRole].filter(Boolean);
  if (effectiveRoles.some((r) => isKnownRole(r) && r !== 'client')) {
    throw appError(403, 'forbidden', 'Only client accounts are supported by magic login.');
  }

  if (existingRole !== 'client' || firestoreRole !== 'client') {
    await assignUserRole(userRecord.uid, 'client');
  }
}

async function startMagicChallenge(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!isNonEmptyString(normalizedEmail)) throw appError(400, 'invalid_payload', 'email is required.');

  const { userRecord } = await getOrCreateUserByEmail(normalizedEmail);
  await ensureClientRole(userRecord);

  const otp = generateOtp();
  const salt = generateSalt();
  const codeHash = hashCode(otp, salt);

  const challengeRef = db.collection(COLLECTION).doc();
  const challengeId = challengeRef.id;

  const now = Date.now();

  await challengeRef.set({
    email: normalizedEmail,
    uid: userRecord.uid,
    codeHash,
    codeSalt: salt,
    attempts: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(now + OTP_TTL_MS),
    used: false,
  });

  const link = buildMagicLink(challengeId, normalizedEmail);
  if (process.env.NODE_ENV !== 'production') {
    logger.debug(`email=${normalizedEmail} code=${otp} link=${link}`);
  }

  return { challengeId };
}

async function verifyMagicChallenge(email, challengeId, code) {
  const normalizedEmail = normalizeEmail(email);
  if (!isNonEmptyString(normalizedEmail)) throw appError(400, 'invalid_payload', 'email is required.');
  if (!isNonEmptyString(challengeId)) throw appError(400, 'invalid_payload', 'challengeId is required.');
  if (!isNonEmptyString(code)) throw appError(400, 'invalid_payload', 'code is required.');

  const ref = db.collection(COLLECTION).doc(String(challengeId).trim());
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  let uid = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw appError(401, 'invalid_token', 'Invalid or expired code.');
    }

    const data = snap.data() || {};

    if (data.used === true) {
      throw appError(401, 'invalid_token', 'Invalid or expired code.');
    }

    if (typeof data.email !== 'string' || data.email.trim().toLowerCase() !== normalizedEmail) {
      throw appError(401, 'invalid_token', 'Invalid or expired code.');
    }

    const expiresAtMs =
      data.expiresAt && typeof data.expiresAt.toMillis === 'function' ? data.expiresAt.toMillis() : 0;
    if (!expiresAtMs || expiresAtMs <= Date.now()) {
      tx.update(ref, { used: true, updatedAt: serverTimestamp });
      throw appError(401, 'invalid_token', 'Invalid or expired code.');
    }

    const attempts = Number.isInteger(data.attempts) ? data.attempts : 0;
    if (attempts >= MAX_ATTEMPTS) {
      tx.update(ref, { used: true, updatedAt: serverTimestamp });
      throw appError(401, 'invalid_token', 'Invalid or expired code.');
    }

    const salt = typeof data.codeSalt === 'string' ? data.codeSalt : '';
    const expected = typeof data.codeHash === 'string' ? data.codeHash : '';
    const actual = hashCode(String(code).trim(), salt);

    const matches = timingSafeEqualHex(expected, actual);

    if (!matches) {
      const nextAttempts = attempts + 1;
      const update = {
        attempts: nextAttempts,
        updatedAt: serverTimestamp,
      };

      if (nextAttempts >= MAX_ATTEMPTS) update.used = true;

      tx.update(ref, update);
      throw appError(401, 'invalid_token', 'Invalid or expired code.');
    }

    if (typeof data.uid !== 'string' || data.uid.trim() === '') {
      tx.update(ref, { used: true, updatedAt: serverTimestamp });
      throw appError(401, 'invalid_token', 'Invalid or expired code.');
    }

    uid = data.uid.trim();

    tx.update(ref, {
      used: true,
      usedAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });
  });

  if (!uid) throw appError(401, 'invalid_token', 'Invalid or expired code.');

  return {
    uid,
    email: normalizedEmail,
  };
}

module.exports = {
  startMagicChallenge,
  verifyMagicChallenge,
};
