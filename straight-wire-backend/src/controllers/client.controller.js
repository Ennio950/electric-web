'use strict';

// Client controllers (frontend contract).
//
// Mounted under /client (verifyFirebaseToken + requireRole('client') are applied per-route in src/routes/client.routes.js).

const { z } = require('zod');

const { auth } = require('../firebase');
const { assignUserRole } = require('../services/roles.service');
const {
  createJobForClient,
  listClientJobs,
  listClientJobsByEmail,
  getJobForClient,
  cancelJobForClient,
} = require('../services/jobs.service');
// DEPRECATED: messages.service.js moved to _deprecated - use /api/marketplace/requests/:id/chat
// const { listMessages, addMessage } = require('../services/messages.service');

function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function createHttpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function serializeTimestamps(obj, fields) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  for (const field of fields) {
    if (field in out) out[field] = toIso(out[field]);
  }
  return out;
}

function serializeJob(job) {
  return serializeTimestamps(job, [
    'createdAt',
    'updatedAt',
    'assignedAt',
    'unassignedAt',
    'startedAt',
    'completedAt',
    'cancelledAt',
    'claimedAt',
  ]);
}

function serializeMessage(msg) {
  return serializeTimestamps(msg, ['createdAt']);
}

function serializeClientRequest(job, fallbackEmail) {
  if (!job) return null;
  const jobEmail =
    typeof job.email === 'string' && job.email.trim() !== ''
      ? job.email.trim()
      : typeof job.emailLower === 'string' && job.emailLower.trim() !== ''
        ? job.emailLower.trim()
        : null;

  const email = jobEmail || fallbackEmail || null;

  return {
    id: job.id,
    status: job.status,
    createdAt: toIso(job.createdAt),
    updatedAt: toIso(job.updatedAt),
    email,
  };
}

function sendError(res, status, error, message) {
  return res.status(status).json({ error, message });
}

function handleError(res, err) {
  const status = err && typeof err.status === 'number' ? err.status : 500;
  const error = err && typeof err.code === 'string' ? err.code : 'internal_error';
  const message = status >= 500 ? 'Internal Server Error' : err.message || 'Request failed.';
  const normalizedStatus = status === 409 ? 400 : status;
  return sendError(res, normalizedStatus, String(error).toLowerCase(), message);
}

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
});

const createRequestSchema = z.object({
  description: z.string().trim().min(1),
  address: z.string().trim().min(1),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  photos: z.array(z.string().trim().min(1)).optional(),
  contactEmail: z.string().trim().email().optional(),
});

async function resolveClientIdentity(req) {
  const clientId = req.user && req.user.uid;
  if (!clientId) throw createHttpError(401, 'invalid_token', 'Token invalido o expirado.');

  const tokenEmail = req.user && req.user.email;
  const normalizedFromToken = normalizeEmail(tokenEmail);
  const safeTokenEmail = normalizedFromToken ? tokenEmail.trim() : null;

  let recordEmail = null;
  let normalizedFromRecord = null;

  try {
    const userRecord = await auth.getUser(clientId);
    recordEmail = userRecord && typeof userRecord.email === 'string' ? userRecord.email.trim() : '';
    normalizedFromRecord = normalizeEmail(recordEmail);
  } catch (err) {
    if (err && err.code === 'auth/user-not-found') {
      throw createHttpError(401, 'invalid_token', 'Token invalido o expirado.');
    }
    throw err;
  }

  return {
    clientId,
    email: safeTokenEmail || recordEmail || null,
    emailLower: normalizedFromToken || normalizedFromRecord || null,
  };
}

async function register(req, res) {
  let input;
  try {
    input = registerSchema.parse(req.body || {});
  } catch (err) {
    return sendError(res, 400, 'invalid_payload', 'email and password are required.');
  }

  let userRecord;
  try {
    userRecord = await auth.createUser({
      email: input.email,
      password: input.password,
    });
  } catch (err) {
    const code = err && err.code;
    if (code === 'auth/email-already-exists') {
      return sendError(res, 400, 'invalid_payload', 'Email already in use.');
    }
    if (code === 'auth/invalid-email') {
      return sendError(res, 400, 'invalid_payload', 'Invalid email address.');
    }
    if (code === 'auth/invalid-password' || code === 'auth/weak-password') {
      return sendError(res, 400, 'invalid_payload', 'Invalid password.');
    }

    console.error('[client] Failed to create user:', err);
    return sendError(res, 500, 'internal_error', 'Internal Server Error');
  }

  try {
    await assignUserRole(userRecord.uid, 'client');
  } catch (err) {
    // Best-effort cleanup to avoid leaving an auth user without role.
    try {
      await auth.deleteUser(userRecord.uid);
    } catch (cleanupErr) {
      console.error('[client] Failed to cleanup user after role assignment failure:', cleanupErr);
    }

    return handleError(res, err);
  }

  return res.status(201).json({
    role: 'client',
    user: {
      id: userRecord.uid,
      email: userRecord.email,
    },
    message: 'Account created. Sign in from the client using Firebase Auth to obtain an ID token.',
  });
}

async function createRequest(req, res) {
  let identity;
  try {
    identity = await resolveClientIdentity(req);
  } catch (err) {
    return handleError(res, err);
  }

  let input;
  try {
    input = createRequestSchema.parse(req.body || {});
  } catch (err) {
    return sendError(res, 400, 'invalid_payload', 'Invalid request body.');
  }

  const requestEmail =
    identity.email ||
    identity.emailLower ||
    (input.contactEmail && typeof input.contactEmail === 'string' ? input.contactEmail.trim() : '');

  if (!requestEmail) {
    return sendError(res, 400, 'invalid_payload', 'email is required for client requests.');
  }

  try {
    const job = await createJobForClient(identity.clientId, {
      ...input,
      email: requestEmail,
    });
    return res.status(200).json(serializeJob(job));
  } catch (err) {
    return handleError(res, err);
  }
}

async function getLatestRequest(req, res) {
  let identity;
  try {
    identity = await resolveClientIdentity(req);
  } catch (err) {
    return handleError(res, err);
  }

  try {
    let job = null;

    if (identity.emailLower) {
      const jobsByEmail = await listClientJobsByEmail(identity.emailLower, { limit: 1 });
      job = jobsByEmail && jobsByEmail.length > 0 ? jobsByEmail[0] : null;
    }

    if (!job) {
      const jobsById = await listClientJobs(identity.clientId, { limit: 1 });
      job = jobsById && jobsById.length > 0 ? jobsById[0] : null;
    }

    if (!job) {
      return res.status(200).json({ ok: true, data: null });
    }

    return res.status(200).json({
      ok: true,
      data: serializeClientRequest(job, identity.email || identity.emailLower),
    });
  } catch (err) {
    return handleError(res, err);
  }
}

async function getRequestById(req, res) {
  let identity;
  try {
    identity = await resolveClientIdentity(req);
  } catch (err) {
    return handleError(res, err);
  }

  const jobId = req.params && req.params.id;
  if (!jobId) return sendError(res, 400, 'invalid_payload', 'Request id is required.');

  try {
    const job = await getJobForClient(identity.clientId, jobId, { emailLower: identity.emailLower });
    return res.status(200).json({
      ok: true,
      data: serializeClientRequest(job, identity.email || identity.emailLower),
    });
  } catch (err) {
    return handleError(res, err);
  }
}

async function closeRequest(req, res) {
  let identity;
  try {
    identity = await resolveClientIdentity(req);
  } catch (err) {
    return handleError(res, err);
  }

  const jobId = req.params && req.params.id;
  if (!jobId) return sendError(res, 400, 'invalid_payload', 'Request id is required.');

  try {
    const job = await cancelJobForClient(identity.clientId, jobId, { emailLower: identity.emailLower });
    return res.status(200).json(serializeJob(job));
  } catch (err) {
    return handleError(res, err);
  }
}

async function getRequestMessages(req, res) {
  let identity;
  try {
    identity = await resolveClientIdentity(req);
  } catch (err) {
    return handleError(res, err);
  }

  const jobId = req.params && req.params.id;
  if (!jobId) return sendError(res, 400, 'invalid_payload', 'Request id is required.');

  try {
    await getJobForClient(identity.clientId, jobId, { emailLower: identity.emailLower });
    const messages = await listMessages(jobId, { limit: req.query && req.query.limit });
    return res.status(200).json(messages.map(serializeMessage));
  } catch (err) {
    return handleError(res, err);
  }
}

async function postRequestMessage(req, res) {
  let identity;
  try {
    identity = await resolveClientIdentity(req);
  } catch (err) {
    return handleError(res, err);
  }

  const jobId = req.params && req.params.id;
  if (!jobId) return sendError(res, 400, 'invalid_payload', 'Request id is required.');

  const text = req.body && req.body.text;
  if (typeof text !== 'string' || text.trim() === '') {
    return sendError(res, 400, 'invalid_payload', 'text is required.');
  }

  try {
    await getJobForClient(identity.clientId, jobId, { emailLower: identity.emailLower });

    const message = await addMessage(jobId, {
      byUid: identity.clientId,
      byRole: 'client',
      text,
    });

    return res.status(200).json(serializeMessage(message));
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * GET /api/client/me
 * Returns the current authenticated client's info.
 * Used by role-gateway.js to determine if user has client role.
 */
async function getMe(req, res) {
  if (!req.user || !req.user.uid) {
    return res.status(401).json({ ok: false, error: 'unauthenticated', message: 'No token provided.' });
  }

  // Role is already verified by requireRole('client') middleware
  return res.status(200).json({
    ok: true,
    data: {
      id: req.user.uid,
      email: req.user.email || null,
      role: 'client',
    },
  });
}

module.exports = {
  register,
  createRequest,
  getLatestRequest,
  getRequestById,
  closeRequest,
  getRequestMessages,
  postRequestMessage,
  getMe,
};
