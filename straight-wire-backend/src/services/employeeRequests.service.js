'use strict';

// Employee applications (employee role requests).
//
// Collection: employeeRequests/{uid}
// Fields:
// - uid
// - email
// - status: pending | approved | rejected
// - createdAt, updatedAt
// - decidedAt?, decidedBy?

const { admin, db } = require('../firebase');
const { appError, isFirestoreIndexRequiredError } = require('../utils/errors');

const COLLECTION = 'employeeRequests';

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

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw appError(400, 'invalid_payload', `${label} is required.`);
  }
}

function cleanNullableString(value, maxLength = 500) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function ref(id) {
  return db.collection(COLLECTION).doc(id);
}

function mapDoc(doc) {
  return { id: doc.id, ...doc.data() };
}

async function submitEmployeeApplication(uid, email, extraData = {}) {
  if (!uid) throw new Error('uid is required');
  if (!email) throw new Error('email is required');

  const displayName = cleanNullableString(extraData.displayName || extraData.name, 160);
  const phone = cleanNullableString(extraData.phone, 80);
  const address = cleanNullableString(extraData.address, 400);
  const photoUrl = cleanNullableString(extraData.photoUrl, 2000);

  const applicationDocRef = ref(uid); // Document ID is the UID
  // Safe fallback: use JS Date instead of FieldValue to prevent version crashes
  const serverTimestamp = new Date(); // admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(applicationDocRef);
    const existing = snap.exists ? snap.data() : null;

    // If already approved/employee, throw?
    // For now, if pending, we update. If rejected, we re-open.
    if (existing && existing.status === 'pending') {
      throw appError(400, 'already_applied', 'You already have a pending application.');
    }

    const update = {
      uid,
      email: email.trim().toLowerCase(),
      name: displayName,
      displayName,
      status: 'pending',
      updatedAt: serverTimestamp,
      phone,
      address,
      photoUrl,
    };

    if (!existing || existing.createdAt == null) {
      update.createdAt = serverTimestamp;
    }

    tx.set(applicationDocRef, update, { merge: true });
  });

  const fresh = await applicationDocRef.get();
  return mapDoc(fresh);
}

async function listEmployeeApplications(options = {}) {
  const status =
    typeof options.status === 'string' && options.status.trim() !== '' ? options.status.trim() : 'pending';
  const limit = normalizeLimit(options.limit, 100);

  try {
    const snap = await db
      .collection(COLLECTION)
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
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
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      .slice(0, limit);
  }
}

async function getEmployeeApplication(id) {
  requireNonEmptyString(id, 'id');

  const snap = await ref(id).get();
  if (!snap.exists) throw appError(404, 'not_found', 'Employee request not found.');
  return mapDoc(snap);
}

async function setEmployeeApplicationStatus(id, nextStatus, meta = {}) {
  requireNonEmptyString(id, 'id');
  requireNonEmptyString(nextStatus, 'status');

  const allowed = new Set(['approved', 'rejected']);
  if (!allowed.has(nextStatus)) {
    throw appError(400, 'invalid_payload', 'status must be approved | rejected.');
  }

  const applicationRef = ref(id);
  const serverTimestamp = new Date(); // Safe for all versions

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(applicationRef);
    if (!snap.exists) throw appError(404, 'not_found', 'Employee request not found.');

    const data = snap.data() || {};
    if (data.status !== 'pending') {
      throw appError(400, 'invalid_state', 'Employee request is not pending.');
    }

    tx.update(applicationRef, {
      status: nextStatus,
      decidedAt: serverTimestamp,
      decidedBy: meta.decidedBy || null,
      updatedAt: serverTimestamp,
    });
  });

  // ✅ AUTO-PROMOTE if approved
  if (nextStatus === 'approved') {
    const freshData = (await applicationRef.get()).data();
    if (freshData && freshData.uid) {
      const displayName = cleanNullableString(freshData.displayName || freshData.name, 160)
        || String(freshData.email || '').split('@')[0]
        || 'employee';

      await admin.auth().setCustomUserClaims(freshData.uid, { role: 'employee' });

      // Sync detailed profile data to public User Profile
      await db.collection('users').doc(freshData.uid).set({
        name: displayName,
        displayName,
        email: freshData.email,
        phone: freshData.phone || null,
        photoUrl: freshData.photoUrl || null,
        profilePhoto: freshData.photoUrl || null,
        address: freshData.address || null,
        role: 'employee',
        createdAt: freshData.createdAt || new Date(),
        updatedAt: new Date()
      }, { merge: true });

      console.log(`[EmployeeRequest] Promoted user ${freshData.uid} and synced profile.`);
    }
  }

  const fresh = await applicationRef.get();
  return mapDoc(fresh);
}

module.exports = {
  submitEmployeeApplication,
  listEmployeeApplications,
  getEmployeeApplication,
  setEmployeeApplicationStatus,
};
