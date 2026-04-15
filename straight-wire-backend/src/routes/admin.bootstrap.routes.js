'use strict';

// Admin/bootstrap routes.
// Mounted under `/api` from `src/index.js`.
//
// Endpoints:
// - POST /api/admin/bootstrap-boss  (one-time; only if no boss exists)
// - POST /api/admin/assign-role     (boss only)

const express = require('express');

const authMiddleware = require('../middleware/auth');
const { db } = require('../firebase');
const { assignUserRole } = require('../services/roles.service');
const { ok, fail } = require('../utils/response');

const router = express.Router();

const USERS_COLLECTION = 'users';
const ALLOWED_ROLES = new Set(['boss', 'employee', 'client']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

async function bossExistsInFirestore() {
  const snap = await db
    .collection(USERS_COLLECTION)
    .where('role', '==', 'boss')
    .limit(1)
    .get();

  return !snap.empty;
}

function handleError(res, err, fallbackCode) {
  const status = err && typeof err.status === 'number' ? err.status : 500;
  const code = err && typeof err.code === 'string' ? err.code : fallbackCode || 'INTERNAL_ERROR';
  const message = status >= 500 ? 'Internal Server Error' : err.message || 'Request failed.';

  if (status >= 500) console.error('[admin]', err);
  return fail(res, status, code, message);
}

// POST /api/admin/bootstrap-boss
router.post('/admin/bootstrap-boss', authMiddleware, async (req, res) => {
  const uid = req.user && req.user.uid;
  if (!uid) return fail(res, 401, 'UNAUTHENTICATED', 'Authentication required.');

  try {
    if (await bossExistsInFirestore()) {
      console.warn(`[admin] bootstrap-boss blocked (boss already exists). uid=${uid}`);
      return fail(res, 403, 'BOOTSTRAP_DISABLED', 'Boss already exists. Bootstrap is disabled.');
    }
  } catch (err) {
    console.error('[admin] Failed to check boss existence:', err);
    return fail(res, 500, 'BOOTSTRAP_CHECK_FAILED', 'Unable to validate bootstrap preconditions.');
  }

  try {
    const result = await assignUserRole(uid, 'boss');
    return ok(res, {
      ...result,
      message: 'Boss role assigned. Refresh your ID token to receive updated claims.',
    });
  } catch (err) {
    return handleError(res, err, 'BOOTSTRAP_FAILED');
  }
});

// POST /api/admin/assign-role
// Body: { uid, role }
router.post('/admin/assign-role', authMiddleware, async (req, res) => {
  const requesterRole = req.user && req.user.role;
  if (requesterRole !== 'boss') {
    console.warn('[admin] assign-role blocked (requester not boss).');
    return fail(res, 403, 'FORBIDDEN', 'Only boss can assign roles.');
  }

  const targetUid = req.body && req.body.uid;
  const role = req.body && req.body.role;

  if (!isNonEmptyString(targetUid) || !isNonEmptyString(role)) {
    return fail(res, 400, 'INVALID_INPUT', 'uid and role are required.');
  }

  const normalizedRole = role.trim();
  if (!ALLOWED_ROLES.has(normalizedRole)) {
    return fail(res, 400, 'INVALID_ROLE', 'role must be boss | employee | client.');
  }

  try {
    const result = await assignUserRole(targetUid, normalizedRole);
    return ok(res, {
      ...result,
      message: 'Role assigned successfully. User must refresh ID token.',
    });
  } catch (err) {
    return handleError(res, err, 'ASSIGN_ROLE_FAILED');
  }
});

module.exports = router;

