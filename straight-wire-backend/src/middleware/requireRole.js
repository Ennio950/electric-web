'use strict';

// Role guard middleware (factory) + named helpers.
//
// - Reads role from custom claims (req.user.role) when available.
// - Falls back to Firestore /users/{uid}.role with a short-lived cache.
// - Provides legacy response shape for existing routes and flat response for new API routes.

const { db } = require('../firebase');

const CACHE_TTL_MS = 2 * 60 * 1000;
const roleCache = new Map();

function nowMs() {
  return Date.now();
}

function getCachedRole(uid) {
  const entry = roleCache.get(uid);
  if (!entry) return null;

  if (entry.expiresAt <= nowMs()) {
    roleCache.delete(uid);
    return null;
  }

  return entry.role;
}

function setCachedRole(uid, role) {
  roleCache.set(uid, {
    role,
    expiresAt: nowMs() + CACHE_TTL_MS,
  });
}

function sendLegacy(res, status, error, message) {
  return res.status(status).json({ error, message });
}

function sendFlat(res, status, error, message) {
  return res.status(status).json({ ok: false, error, message });
}

function normalizeAllowedRoles(input) {
  const roles = Array.isArray(input) ? input : [input];

  const normalized = roles
    .map((role) => (typeof role === 'string' ? role.trim() : ''))
    .filter(Boolean);

  const unique = Array.from(new Set(normalized));
  if (unique.length === 0) {
    throw new TypeError('requireRole(role) expects a non-empty role string or array of role strings.');
  }

  return unique;
}

async function resolveRole(uid, preferredRole) {
  if (typeof preferredRole === 'string' && preferredRole.trim() !== '') {
    return preferredRole.trim();
  }

  const cached = getCachedRole(uid);
  if (cached) return cached;

  try {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const role = typeof data.role === 'string' ? data.role.trim() : '';
    if (!role) return null;

    setCachedRole(uid, role);
    return role;
  } catch (err) {
    console.error('[requireRole] Failed to resolve role from Firestore:', err);
    return null;
  }
}

function createRequireRole(allowed, options = {}) {
  const allowedRoles = normalizeAllowedRoles(allowed);
  const allowedSet = new Set(allowedRoles);
  const errorStyle = options.errorStyle || 'legacy';
  const send = errorStyle === 'flat' ? sendFlat : sendLegacy;

  return async function requireRoleMiddleware(req, res, next) {
    if (!req.user || !req.user.uid) {
      return send(res, 401, 'unauthorized', 'Authentication required.');
    }

    const uid = req.user.uid;
    const resolvedRole = await resolveRole(uid, req.user.role);
    const role = typeof resolvedRole === 'string' ? resolvedRole.trim() : '';

    if (!role) {
      return send(res, 403, 'forbidden', 'Role required.');
    }

    if (!allowedSet.has(role)) {
      return send(res, 403, 'forbidden', 'Insufficient permissions.');
    }

    req.user.role = role;
    return next();
  };
}

const requireRole = (allowed) => createRequireRole(allowed, { errorStyle: 'legacy' });

const requireClient = createRequireRole('client', { errorStyle: 'flat' });
const requireEmployee = createRequireRole('employee', { errorStyle: 'flat' });
const requireBoss = createRequireRole('boss', { errorStyle: 'flat' });
const requireStaff = createRequireRole(['employee', 'boss'], { errorStyle: 'flat' });
const requireMobileUser = createRequireRole(['client', 'employee', 'boss'], { errorStyle: 'flat' });

requireRole.requireClient = requireClient;
requireRole.requireEmployee = requireEmployee;
requireRole.requireBoss = requireBoss;
requireRole.requireStaff = requireStaff;
requireRole.requireMobileUser = requireMobileUser;

module.exports = requireRole;
