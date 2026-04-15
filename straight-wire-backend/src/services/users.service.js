'use strict';

// Firestore-backed user operations.

const { admin, db } = require('../firebase');
const { appError, isFirestoreIndexRequiredError } = require('../utils/errors');
const { createLogger } = require('../utils/logger');

const USERS_COLLECTION = 'users';
const logger = createLogger('users');

function normalizeLimit(limit, fallback) {
  const parsed = Number(limit);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 200);
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const date = value instanceof Date ? value : null;
  return date ? date.getTime() : 0;
}

async function getUserProfile(uid, options = {}) {
  const notFoundCode = options.notFoundCode || 'USER_NOT_FOUND';
  const notFoundMessage = options.notFoundMessage || 'User profile not found.';

  const doc = await db.collection(USERS_COLLECTION).doc(uid).get();
  if (!doc.exists) {
    throw appError(404, notFoundCode, notFoundMessage);
  }

  return { id: doc.id, ...doc.data() };
}

async function upsertUserProfile(uid, data) {
  const userRef = db.collection(USERS_COLLECTION).doc(uid);
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const existing = snap.exists ? snap.data() : null;

    const update = {
      ...data,
      updatedAt: serverTimestamp,
    };

    if (!existing || existing.createdAt == null) {
      update.createdAt = serverTimestamp;
    }

    tx.set(userRef, update, { merge: true });
  });
}

async function listUsersByRole(role, options = {}) {
  const limit = normalizeLimit(options.limit, 100);

  try {
    const snap = await db
      .collection(USERS_COLLECTION)
      .where('role', '==', role)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    if (!isFirestoreIndexRequiredError(err)) throw err;

    const snap = await db
      .collection(USERS_COLLECTION)
      .where('role', '==', role)
      .limit(200)
      .get();

    return snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      .slice(0, limit);
  }
}

/**
 * Ensures a user profile exists with at least role=client.
 * - If doc doesn't exist: creates with role=client
 * - If doc exists but no role: sets role=client
 * - If doc exists with role: does NOT change role (security)
 * 
 * Returns: { id, role, created, ...userData }
 * - created: true if new doc was created, false if already existed
 * 
 * @param {string} uid 
 * @param {string} email 
 * @param {object} options - { displayName? }
 */
async function ensureUserProfile(uid, email, options = {}) {
  if (!uid || typeof uid !== 'string') {
    throw appError(400, 'invalid_input', 'uid is required');
  }

  const userRef = db.collection(USERS_COLLECTION).doc(uid);
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  let wasCreated = false;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);

    if (!snap.exists) {
      // Create new user with role=client
      wasCreated = true;
      const newData = {
        uid,
        email: email || null,
        role: 'client',
        displayName: options.displayName || null,
        isGuest: false,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      };
      tx.set(userRef, newData);
      logger.info('Created new user:', uid, 'role=client');
    } else {
      const existing = snap.data();

      // Only set role if none exists (security: never overwrite role)
      if (!existing.role) {
        tx.update(userRef, {
          role: 'client',
          updatedAt: serverTimestamp,
        });
        logger.info('Set role=client for existing user:', uid);
      } else {
        // Just update updatedAt
        tx.update(userRef, { updatedAt: serverTimestamp });
        logger.debug('User already has role:', uid, existing.role);
      }
    }
  });

  // Return fresh data with created flag
  const freshDoc = await userRef.get();
  return {
    id: freshDoc.id,
    created: wasCreated,
    ...freshDoc.data()
  };
}

module.exports = {
  getUserProfile,
  upsertUserProfile,
  listUsersByRole,
  ensureUserProfile,
};
