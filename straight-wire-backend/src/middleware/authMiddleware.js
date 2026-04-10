'use strict';

// Auth middlewares for Firebase ID tokens.
// - verifyFirebaseIdToken: validates Authorization: Bearer <ID_TOKEN> using Firebase Admin.
// - employeeOnly: ensures req.user.role === 'employee'.

const { db } = require('../firebase');
const { verifyRequestAuth } = require('../services/requestAuth.service');
const { validateSessionCsrf } = require('./sessionCsrf');
const { createLogger } = require('../utils/logger');

const logger = createLogger('authMiddleware');

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
    const role = typeof data.role === 'string' ? data.role.trim() : '';
    return role || null;
  } catch (err) {
    logger.warn('Failed to resolve role from Firestore:', err && err.code ? err.code : err);
    return null;
  }
}

async function verifyFirebaseIdToken(req, res, next) {
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
  if (!decoded || !decoded.uid) {
    return send(res, 401, 'invalid_token', 'Token invalido o expirado.');
  }

  const role = await resolveRole(decoded.uid, decoded.role);

  req.user = {
    uid: decoded.uid,
    email:
      decoded.email && typeof decoded.email === 'string' && decoded.email.trim() !== ''
        ? decoded.email.trim()
        : null,
    role:
      role && typeof role === 'string' && role.trim() !== ''
        ? role.trim()
        : null,
    decoded,
  };
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

function employeeOnly(req, res, next) {
  if (!req.user || !req.user.uid) {
    return send(res, 401, 'unauthorized', 'Authentication required.');
  }

  const role = req.user.role;
  if (role !== 'employee') {
    return send(res, 403, 'forbidden', 'Employee role required.');
  }

  return next();
}

module.exports = {
  verifyFirebaseIdToken,
  employeeOnly,
};
