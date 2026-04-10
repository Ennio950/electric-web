'use strict';

// verifyFirebaseToken middleware
// - Reads Authorization: Bearer <ID_TOKEN>
// - Verifies the Firebase ID Token using Firebase Admin SDK
// - Injects req.user with the decoded token (plus resolved role)
// Error contract:
// - 401 when token is missing/invalid
// - 403 when the user has no role

const { db } = require('../firebase');
const { verifyRequestAuth } = require('../services/requestAuth.service');
const { validateSessionCsrf } = require('./sessionCsrf');
const { createLogger } = require('../utils/logger');

const logger = createLogger('verifyFirebaseToken');

function send(res, status, error, message) {
  return res.status(status).json({ error, message });
}

async function resolveRole(uid, decodedRole) {
  if (typeof decodedRole === 'string' && decodedRole.trim() !== '') {
    return decodedRole.trim();
  }

  try {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    return typeof data.role === 'string' && data.role.trim() !== '' ? data.role.trim() : null;
  } catch (err) {
    logger.error('Failed to resolve role from Firestore:', err);
    return null;
  }
}

function isAllowedRole(role) {
  return role === 'boss' || role === 'employee' || role === 'client';
}

async function verifyFirebaseToken(req, res, next) {
  let verified;
  try {
    verified = await verifyRequestAuth(req, {
      allowSessionCookie: true,
      checkRevoked: true,
    });
  } catch (err) {
    logger.warn('Token verification failed:', err && err.code ? err.code : err);
    return send(res, 401, 'invalid_token', 'Token invalido o expirado.');
  }

  if (!verified) return send(res, 401, 'unauthorized', 'Authorization token is required.');

  const decoded = verified.decoded;
  const uid = decoded && decoded.uid;
  if (!uid) return send(res, 401, 'invalid_token', 'Token invalido o expirado.');

  const role = await resolveRole(uid, decoded && decoded.role);
  const normalizedRole = typeof role === 'string' ? role.trim() : '';

  // Relaxed check: Allow users without role to pass (for registration/application flow)
  // Specific routes will enforce role requirements via requireRole middleware.
  // if (!isAllowedRole(normalizedRole)) return send(res, 403, 'forbidden', 'Role required.');

  req.user = { ...decoded, role: normalizedRole };
  req.authTokenSource = verified.source;
  req.authTokenRaw = verified.rawToken;

  const csrfCheck = validateSessionCsrf(req, {
    isDevelopment: process.env.NODE_ENV !== 'production',
  });
  if (!csrfCheck.ok) {
    return send(res, 403, 'csrf_invalid', csrfCheck.error);
  }

  return next();
}

module.exports = verifyFirebaseToken;
