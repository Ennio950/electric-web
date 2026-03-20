'use strict';

/**
 * Employee Photo Change Requests
 *
 * Collection: employeePhotoRequests/{uid}
 * Fields:
 * - uid, email, displayName
 * - status: pending | approved | rejected | completed
 * - requestedAt, approvedAt, approvedBy, rejectedAt, rejectedBy, completedAt, updatedAt
 * - currentPhotoUrl, newPhotoUrl
 */

const { admin, db } = require('../firebase');
const { appError, isFirestoreIndexRequiredError } = require('../utils/errors');

const COLLECTION = 'employeePhotoRequests';

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw appError(400, 'invalid_payload', `${label} is required.`);
  }
  return value.trim();
}

function normalizeLimit(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 200);
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const date = value instanceof Date ? value : null;
  return date ? date.getTime() : 0;
}

function ref(id) {
  return db.collection(COLLECTION).doc(id);
}

function mapDoc(doc) {
  return { id: doc.id, ...doc.data() };
}

async function getPhotoChangeRequest(uid) {
  requireNonEmptyString(uid, 'uid');
  const snap = await ref(uid).get();
  if (!snap.exists) return null;
  return mapDoc(snap);
}

async function requestPhotoChange(uid, email, displayName) {
  requireNonEmptyString(uid, 'uid');
  requireNonEmptyString(email, 'email');

  const docRef = ref(uid);
  const serverTimestamp = new Date();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const existing = snap.exists ? snap.data() : null;

    if (existing && (existing.status === 'pending' || existing.status === 'approved')) {
      throw appError(400, 'invalid_state', 'Ya tienes una solicitud activa.');
    }

    // Pull current photo from users doc for boss context.
    let currentPhotoUrl = null;
    try {
      const userSnap = await db.collection('users').doc(uid).get();
      if (userSnap.exists) {
        const user = userSnap.data() || {};
        currentPhotoUrl = user.profilePhoto || user.photoUrl || user.photoURL || null;
      }
    } catch (err) {
      // Ignore, not critical
    }

    const payload = {
      uid,
      email: email.trim().toLowerCase(),
      displayName: displayName || null,
      status: 'pending',
      currentPhotoUrl,
      updatedAt: serverTimestamp,
      requestedAt: serverTimestamp,
    };

    if (!existing || existing.createdAt == null) {
      payload.createdAt = serverTimestamp;
    }

    tx.set(docRef, payload, { merge: true });
  });

  const fresh = await docRef.get();
  return mapDoc(fresh);
}

async function listPhotoChangeRequests(options = {}) {
  const status =
    typeof options.status === 'string' && options.status.trim() !== '' ? options.status.trim() : 'pending';
  const limit = normalizeLimit(options.limit, 100);

  try {
    const snap = await db
      .collection(COLLECTION)
      .where('status', '==', status)
      .orderBy('requestedAt', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map(mapDoc);
  } catch (err) {
    if (!isFirestoreIndexRequiredError(err)) throw err;

    const snap = await db
      .collection(COLLECTION)
      .where('status', '==', status)
      .limit(200)
      .get();

    return snap.docs
      .map(mapDoc)
      .sort((a, b) => toMillis(b.requestedAt) - toMillis(a.requestedAt))
      .slice(0, limit);
  }
}

async function approvePhotoChange(uid, bossUid) {
  requireNonEmptyString(uid, 'uid');
  const docRef = ref(uid);
  const serverTimestamp = new Date();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) throw appError(404, 'not_found', 'Solicitud no encontrada.');
    const data = snap.data() || {};
    if (data.status !== 'pending') {
      throw appError(400, 'invalid_state', 'La solicitud no está pendiente.');
    }
    tx.update(docRef, {
      status: 'approved',
      approvedAt: serverTimestamp,
      approvedBy: bossUid || null,
      updatedAt: serverTimestamp,
    });
  });

  const fresh = await docRef.get();
  return mapDoc(fresh);
}

async function rejectPhotoChange(uid, bossUid) {
  requireNonEmptyString(uid, 'uid');
  const docRef = ref(uid);
  const serverTimestamp = new Date();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) throw appError(404, 'not_found', 'Solicitud no encontrada.');
    const data = snap.data() || {};
    if (data.status !== 'pending') {
      throw appError(400, 'invalid_state', 'La solicitud no está pendiente.');
    }
    tx.update(docRef, {
      status: 'rejected',
      rejectedAt: serverTimestamp,
      rejectedBy: bossUid || null,
      updatedAt: serverTimestamp,
    });
  });

  const fresh = await docRef.get();
  return mapDoc(fresh);
}

async function completePhotoChange(uid, photoUrl) {
  requireNonEmptyString(uid, 'uid');
  requireNonEmptyString(photoUrl, 'photoUrl');

  const docRef = ref(uid);
  const serverTimestamp = new Date();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) throw appError(404, 'not_found', 'Solicitud no encontrada.');
    const data = snap.data() || {};

    // Idempotent: if already completed, do not fail on duplicate submits.
    if (data.status === 'completed') {
      return;
    }

    if (data.status !== 'approved') {
      throw appError(400, 'invalid_state', 'Solicitud no aprobada o ya finalizada.');
    }

    const userRef = db.collection('users').doc(uid);
    tx.set(userRef, {
      photoUrl: photoUrl.trim(),
      profilePhoto: photoUrl.trim(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    tx.update(docRef, {
      status: 'completed',
      newPhotoUrl: photoUrl.trim(),
      completedAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });
  });

  const fresh = await docRef.get();
  return mapDoc(fresh);
}

module.exports = {
  getPhotoChangeRequest,
  requestPhotoChange,
  listPhotoChangeRequests,
  approvePhotoChange,
  rejectPhotoChange,
  completePhotoChange,
};
