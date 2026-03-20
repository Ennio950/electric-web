'use strict';

// Auth controllers for:
// - POST /auth/google
// - POST /auth/magic/start
// - POST /auth/magic/verify
//
// Success responses (EXACT):
// - google/verify: { token, role:"client", user:{ id, email } }
// - start: { challengeId, delivery:"email" }

const { z } = require('zod');

const { admin, auth, db } = require('../firebase');
const { assignUserRole } = require('../services/roles.service');
const { createCustomToken, signInWithCustomToken } = require('../services/auth.service');
const { startMagicChallenge, verifyMagicChallenge } = require('../services/magicAuth.service');

function sendError(res, status, error, message) {
  const safeMessage = status >= 500 ? 'Internal Server Error' : message;
  const safeError = status >= 500 ? 'internal_error' : error;

  return res.status(status).json({
    error: safeError,
    message: safeMessage,
  });
}

function isKnownRole(role) {
  return role === 'boss' || role === 'employee' || role === 'client';
}

function normalizeRole(role) {
  return typeof role === 'string' ? role.trim() : '';
}

const googleSchema = z.object({
  idToken: z.string().trim().min(1),
});

const magicStartSchema = z.object({
  email: z.string().trim().email(),
});

const magicVerifySchema = z.object({
  email: z.string().trim().email(),
  challengeId: z.string().trim().min(1),
  code: z.string().trim().min(6).max(6),
});

async function postGoogle(req, res) {
  let input;
  try {
    input = googleSchema.parse(req.body || {});
  } catch (err) {
    return sendError(res, 400, 'invalid_payload', 'idToken is required.');
  }

  let decoded;
  try {
    decoded = await auth.verifyIdToken(input.idToken);
  } catch (err) {
    return sendError(res, 401, 'invalid_token', 'Invalid token.');
  }

  const uid = decoded && decoded.uid ? decoded.uid : null;
  const email = decoded && typeof decoded.email === 'string' ? decoded.email.trim() : null;

  if (!uid || !email) {
    return sendError(res, 400, 'invalid_payload', 'Email not available for this account.');
  }

  // Protect boss/employee accounts from being overwritten by client login flows.
  try {
    const userRecord = await auth.getUser(uid);
    const existingRole = normalizeRole(
      userRecord && userRecord.customClaims && typeof userRecord.customClaims === 'object'
        ? userRecord.customClaims.role
        : '',
    );

    let firestoreRole = '';
    try {
      const snap = await db.collection('users').doc(uid).get();
      if (snap.exists) {
        const data = snap.data() || {};
        firestoreRole = typeof data.role === 'string' ? data.role.trim() : '';
      }
    } catch (readErr) {
      console.error('[auth/google] Failed to read Firestore role:', readErr);
    }

    const rolesToCheck = [existingRole, firestoreRole].filter(Boolean);
    if (rolesToCheck.some((r) => isKnownRole(r) && r !== 'client')) {
      return sendError(res, 403, 'forbidden', 'Only client accounts are supported by Google login.');
    }

    if (existingRole !== 'client') {
      await assignUserRole(uid, 'client');
    } else {
      // Ensure Firestore user doc exists/updated (used as a server-side fallback for missing claims).
      const userRef = db.collection('users').doc(uid);
      const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const existing = snap.exists ? snap.data() : null;

        const update = {
          email,
          role: 'client',
          updatedAt: serverTimestamp,
        };

        if (!existing || existing.createdAt == null) {
          update.createdAt = serverTimestamp;
        }

        tx.set(userRef, update, { merge: true });
      });
    }
  } catch (err) {
    console.error('[auth/google] Role sync failed:', err);
    return sendError(res, 500, 'internal_error', 'Internal Server Error');
  }

  // Prefer returning a fresh ID token minted from a custom token exchange.
  let idToken;
  let customToken;
  try {
    customToken = await createCustomToken(uid, { role: 'client' });
    const signIn = await signInWithCustomToken(customToken);
    idToken = signIn.idToken;
  } catch (err) {
    console.error('[auth/google] Failed to mint ID token:', err);
    return sendError(res, 500, 'internal_error', 'Internal Server Error');
  }

  return res.status(200).json({
    token: idToken,
    customToken,
    role: 'client',
    user: { id: uid, email },
  });
}

async function postMagicStart(req, res) {
  let input;
  try {
    input = magicStartSchema.parse(req.body || {});
  } catch (err) {
    return sendError(res, 400, 'invalid_payload', 'email is required.');
  }

  try {
    const result = await startMagicChallenge(input.email);
    return res.status(200).json({
      challengeId: result.challengeId,
      delivery: 'email',
    });
  } catch (err) {
    if (err && typeof err.status === 'number') {
      return sendError(res, err.status, err.code || 'internal_error', err.message || 'Request failed.');
    }
    console.error('[auth/magic/start] Unexpected error:', err);
    return sendError(res, 500, 'internal_error', 'Internal Server Error');
  }
}

async function postMagicVerify(req, res) {
  let input;
  try {
    input = magicVerifySchema.parse(req.body || {});
  } catch (err) {
    return sendError(res, 400, 'invalid_payload', 'Invalid request body.');
  }

  let result;
  try {
    result = await verifyMagicChallenge(input.email, input.challengeId, input.code);
  } catch (err) {
    if (err && typeof err.status === 'number') {
      return sendError(res, err.status, err.code || 'internal_error', err.message || 'Request failed.');
    }
    console.error('[auth/magic/verify] Unexpected error:', err);
    return sendError(res, 500, 'internal_error', 'Internal Server Error');
  }

  let idToken;
  let customToken;
  try {
    customToken = await createCustomToken(result.uid, { role: 'client' });
    const signIn = await signInWithCustomToken(customToken);
    idToken = signIn.idToken;
  } catch (err) {
    console.error('[auth/magic/verify] Failed to mint ID token:', err);
    return sendError(res, 500, 'internal_error', 'Internal Server Error');
  }

  return res.status(200).json({
    token: idToken,
    customToken,
    role: 'client',
    user: {
      id: result.uid,
      email: result.email,
    },
  });
}

module.exports = {
  postGoogle,
  postMagicStart,
  postMagicVerify,
};
