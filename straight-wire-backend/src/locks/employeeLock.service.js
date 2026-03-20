'use strict';

// Employee lock service (Firestore).
//
// Goal:
// - Prevent an employee from being assigned/working on multiple active jobs at the same time.
//
// Data model: employeeLocks/{employeeId}
// - activeJobId: string | null
// - updatedAt: serverTimestamp
//
// IMPORTANT:
// - These functions are designed to be used INSIDE an existing Firestore transaction.

const { admin, db } = require('../firebase');
const { appError } = require('../utils/errors');

const COLLECTION = 'employeeLocks';

function lockRef(employeeId) {
  return db.collection(COLLECTION).doc(employeeId);
}

function requireTx(tx) {
  if (!tx) {
    throw new TypeError('employeeLock.service requires a Firestore transaction (tx).');
  }
}

function requireId(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
}

async function acquireLock(tx, employeeId, jobId) {
  requireTx(tx);
  requireId(employeeId, 'employeeId');
  requireId(jobId, 'jobId');

  const ref = lockRef(employeeId);
  const snap = await tx.get(ref);

  if (snap.exists) {
    const data = snap.data() || {};
    const activeJobId = typeof data.activeJobId === 'string' ? data.activeJobId : null;

    if (activeJobId && activeJobId !== jobId) {
      throw appError(409, 'EMPLOYEE_LOCKED', 'Employee already has an active job.');
    }
  }

  tx.set(
    ref,
    {
      activeJobId: jobId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function releaseLock(tx, employeeId, jobId) {
  requireTx(tx);
  requireId(employeeId, 'employeeId');
  requireId(jobId, 'jobId');

  const ref = lockRef(employeeId);
  const snap = await tx.get(ref);

  if (!snap.exists) return;

  const data = snap.data() || {};
  const activeJobId = typeof data.activeJobId === 'string' ? data.activeJobId : null;

  // Only release if the lock is held by this job (best-effort safety).
  if (activeJobId !== jobId) return;

  tx.set(
    ref,
    {
      activeJobId: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

module.exports = {
  acquireLock,
  releaseLock,
};
