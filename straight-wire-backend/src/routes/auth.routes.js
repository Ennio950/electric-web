'use strict';

// Auth routes (frontend contract).
// Backend validates tokens; it no longer performs email/password logins.
// Endpoints:
// - GET  /auth/me
// - POST /auth/ensure-user  (ensures user profile exists with role=client)
// - POST /auth/google
// - POST /auth/magic/start
// - POST /auth/magic/verify

const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const { auth } = require('../firebase');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const verifyIdTokenOnly = require('../middleware/verifyIdTokenOnly');
const { ensureUserProfile } = require('../services/users.service');
const {
  PORTAL_CSRF_COOKIE,
  PORTAL_SESSION_MAX_AGE_MS,
  buildPortalCsrfCookieOptions,
  buildPortalSessionCookieOptions,
  clearPortalCsrfCookie,
  clearPortalSessionCookie,
  createCsrfToken,
} = require('../utils/authTokens');
const { createLogger } = require('../utils/logger');
const {
  postGoogle,
  postMagicStart,
  postMagicVerify,
} = require('../controllers/auth.magic.controller');

const router = express.Router();
const logger = createLogger('auth.routes');

function sendError(res, status, error, message) {
  return res.status(status).json({ error, message });
}

function isAllowedRole(role) {
  return role === 'boss' || role === 'employee' || role === 'client';
}

function normalizeRole(role) {
  return typeof role === 'string' ? role.trim().toLowerCase() : '';
}

router.get('/me', verifyFirebaseToken, async (req, res) => {
  const uid = req.user && req.user.uid;
  const email =
    req.user && typeof req.user.email === 'string' && req.user.email.trim() !== ''
      ? req.user.email.trim()
      : null;
  const decodedRole = req.user && req.user.role;

  if (!uid) {
    return sendError(res, 401, 'invalid_token', 'Token invalido o expirado.');
  }

  if (!isAllowedRole(decodedRole)) {
    return sendError(res, 403, 'forbidden', 'User role is not assigned.');
  }

  return res.status(200).json({
    role: decodedRole,
    user: {
      id: uid,
      email,
    },
  });
});

router.post('/portal-session', verifyFirebaseToken, async (req, res) => {
  const authSource = req.authTokenSource;
  const idToken = req.authTokenRaw;
  const role = normalizeRole(req.user && req.user.role);
  const requestedRole = normalizeRole(req.body && req.body.role);

  if (authSource !== 'id_token' || typeof idToken !== 'string' || idToken.trim() === '') {
    return sendError(res, 401, 'unauthorized', 'Authorization token is required.');
  }

  if (!isAllowedRole(role)) {
    return sendError(res, 403, 'forbidden', 'User role is not assigned.');
  }

  if (requestedRole && requestedRole !== role) {
    return sendError(res, 403, 'forbidden', 'Requested role does not match authenticated user.');
  }

  try {
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: PORTAL_SESSION_MAX_AGE_MS,
    });
    const csrfToken = createCsrfToken();

    res.cookie(
      'swe_portal_session',
      sessionCookie,
      buildPortalSessionCookieOptions(req, {
        maxAge: PORTAL_SESSION_MAX_AGE_MS,
      }),
    );
    res.cookie(
      PORTAL_CSRF_COOKIE,
      csrfToken,
      buildPortalCsrfCookieOptions(req, {
        maxAge: PORTAL_SESSION_MAX_AGE_MS,
      }),
    );
    res.set('Cache-Control', 'no-store');

    return res.status(200).json({
      ok: true,
      role,
      expiresInMs: PORTAL_SESSION_MAX_AGE_MS,
      csrfToken,
    });
  } catch (err) {
    logger.error('Failed to mint portal session cookie:', err);
    return sendError(res, 500, 'internal_error', 'Internal Server Error');
  }
});

router.delete('/portal-session', (req, res) => {
  clearPortalSessionCookie(res, req);
  clearPortalCsrfCookie(res, req);
  res.set('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true });
});

/**
 * POST /auth/ensure-user
 * 
 * Ensures the authenticated user has a Firestore profile with at least role=client.
 * Called by frontend AFTER Firebase Auth signup/login to guarantee the user doc exists.
 * 
 * Security:
 * - Body.role is IGNORED - never allows setting role from frontend
 * - If role already exists in Firestore, it's NOT changed (boss/employee stay)
 * - Only creates role=client for new users or users without a role
 * 
 * Request:
 *   Headers: Authorization: Bearer <Firebase ID Token>
 *   Body (optional): { displayName?: string }
 * 
 * Response:
 *   200 { ok: true, uid, email, role }
 */
router.post('/ensure-user', verifyIdTokenOnly, async (req, res) => {
  const uid = req.user && req.user.uid;
  const email = req.user && req.user.email;

  if (!uid) {
    return sendError(res, 401, 'invalid_token', 'Token invalido o expirado.');
  }

  try {
    // Get optional displayName from body (ignore any role field for security)
    const displayName = req.body && typeof req.body.displayName === 'string'
      ? req.body.displayName.trim()
      : null;

    const result = await ensureUserProfile(uid, email, { displayName });

    logger.info('ensure-user success:', { uid, role: result.role, created: result.created });

    return res.status(200).json({
      ok: true,
      uid,
      email: email || null,
      role: result.role,
      created: result.created || false,
    });
  } catch (err) {
    logger.error('ensure-user error:', err);
    const status = err.status || 500;
    const error = err.code || 'internal_error';
    const message = status >= 500 ? 'Internal Server Error' : err.message || 'Request failed.';
    return sendError(res, status, error, message);
  }
});

// POST /auth/google
router.post('/google', postGoogle);

// Extra rate limiting for magic start (per IP + per email)
const magicStartByIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Too many requests. Try again later.' },
});

const magicStartByEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Too many requests. Try again later.' },
  keyGenerator: (req) => {
    const email =
      req.body && typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return email || ipKeyGenerator(req);
  },
});

const magicVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Too many requests. Try again later.' },
});

// POST /auth/magic/start
router.post('/magic/start', magicStartByIpLimiter, magicStartByEmailLimiter, postMagicStart);

// POST /auth/magic/verify
router.post('/magic/verify', magicVerifyLimiter, postMagicVerify);

module.exports = router;
