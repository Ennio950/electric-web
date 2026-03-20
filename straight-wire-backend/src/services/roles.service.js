'use strict';

// Firebase Custom Claims + Firestore sync for user roles.

const { admin, auth, db } = require('../firebase');
const { appError } = require('../utils/errors');

const USERS_COLLECTION = 'users';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

async function assignUserRole(uid, role) {
  if (!isNonEmptyString(uid)) {
    throw appError(400, 'INVALID_INPUT', 'uid is required.');
  }
  if (!isNonEmptyString(role)) {
    throw appError(400, 'INVALID_ROLE', 'role is required.');
  }

  const normalizedUid = uid.trim();
  const normalizedRole = role.trim();

  // 1) Read existing claims so we can merge/rollback safely.
  let userRecord;
  let previousClaims = null;
  try {
    userRecord = await auth.getUser(normalizedUid);
    previousClaims =
      userRecord.customClaims && typeof userRecord.customClaims === 'object'
        ? userRecord.customClaims
        : null;
  } catch (err) {
    console.error('[roles] Failed to read user record:', err);
    throw appError(500, 'USER_READ_FAILED', 'Unable to read user record.');
  }

  const nextClaims = { ...(previousClaims || {}), role: normalizedRole };

  // 2) Write custom claims.
  try {
    await auth.setCustomUserClaims(normalizedUid, nextClaims);
  } catch (err) {
    console.error('[roles] Failed to set custom claims:', err);
    throw appError(500, 'CLAIMS_WRITE_FAILED', 'Unable to assign role.');
  }

  // 3) Sync Firestore user doc.
  const userRef = db.collection(USERS_COLLECTION).doc(normalizedUid);
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const existing = snap.exists ? snap.data() : null;

      const update = {
        role: normalizedRole,
        updatedAt: serverTimestamp,
      };

      // Preserve existing status if present (e.g., disabled users should not be re-activated here).
      if (!existing || existing.status == null) {
        update.status = 'active';
      }

      if (isNonEmptyString(userRecord.email)) {
        update.email = userRecord.email.trim();
      }

      if (!existing || existing.createdAt == null) {
        update.createdAt = serverTimestamp;
      }

      tx.set(userRef, update, { merge: true });
    });
  } catch (err) {
    console.error('[roles] Failed to sync Firestore user doc after setting claims:', err);

    // Best-effort rollback: restore original claims so we don't leave inconsistent state.
    try {
      const restoreClaims =
        previousClaims && Object.keys(previousClaims).length > 0 ? previousClaims : null;
      await auth.setCustomUserClaims(normalizedUid, restoreClaims);
    } catch (rollbackErr) {
      console.error('[roles] Failed to rollback custom claims after Firestore failure:', rollbackErr);
    }

    throw appError(500, 'FIRESTORE_SYNC_FAILED', 'Unable to persist role assignment.');
  }

  return {
    uid: normalizedUid,
    role: normalizedRole,
    email: isNonEmptyString(userRecord.email) ? userRecord.email.trim() : null,
  };
}

module.exports = {
  assignUserRole,
};
