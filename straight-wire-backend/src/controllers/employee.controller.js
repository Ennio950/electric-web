'use strict';

// Employee controllers (frontend contract).
//
// Mounted under /employee (verifyFirebaseToken is applied per-router in src/routes/employee.routes.js).

const { STATUS, listOpenJobs, listEmployeeActiveJobs, claimJobAsEmployee } = require('../services/jobs.service');
// DEPRECATED: messages.service.js moved to _deprecated - use /api/marketplace/requests/:id/chat
// const { listMessages, addMessage } = require('../services/messages.service');
const { db } = require('../firebase');
const { submitEmployeeApplication } = require('../services/employeeRequests.service');

function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
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

function serializeEmployeeRequest(req) {
  return serializeTimestamps(req, ['createdAt', 'updatedAt', 'decidedAt']);
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

async function loadJob(jobId) {
  const snap = await db.collection('jobs').doc(jobId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

async function getDashboard(req, res) {
  const employeeId = req.user && req.user.uid;
  if (!employeeId) return sendError(res, 401, 'invalid_token', 'Token inválido o expirado.');

  try {
    const [open, mine] = await Promise.all([
      listOpenJobs({ limit: 200 }),
      listEmployeeActiveJobs(employeeId),
    ]);

    const assignedRequests = mine.filter((j) => j.status === STATUS.ASSIGNED).length;
    const inProgressRequests = mine.filter((j) => j.status === STATUS.IN_PROGRESS).length;

    return res.status(200).json({
      openRequests: open.length,
      assignedRequests,
      inProgressRequests,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

async function getRequests(req, res) {
  const employeeId = req.user && req.user.uid;
  if (!employeeId) return sendError(res, 401, 'invalid_token', 'Token inválido o expirado.');

  try {
    const [open, mine] = await Promise.all([
      listOpenJobs({ limit: 200 }),
      listEmployeeActiveJobs(employeeId),
    ]);

    const byId = new Map();
    for (const job of open) byId.set(job.id, job);
    for (const job of mine) byId.set(job.id, job);

    const merged = Array.from(byId.values());

    // Prefer a predictable order for the frontend.
    merged.sort((a, b) => {
      const aMs = a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : 0;
      const bMs = b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : 0;
      return bMs - aMs;
    });

    return res.status(200).json(merged.map(serializeJob));
  } catch (err) {
    return handleError(res, err);
  }
}

async function claimRequest(req, res) {
  const employeeId = req.user && req.user.uid;
  if (!employeeId) return sendError(res, 401, 'invalid_token', 'Token inválido o expirado.');

  const jobId = req.params && req.params.id;
  if (!jobId) return sendError(res, 400, 'invalid_payload', 'Request id is required.');

  try {
    const job = await claimJobAsEmployee(employeeId, jobId);
    return res.status(200).json(serializeJob(job));
  } catch (err) {
    return handleError(res, err);
  }
}

async function getRequestMessages(req, res) {
  const employeeId = req.user && req.user.uid;
  if (!employeeId) return sendError(res, 401, 'invalid_token', 'Token inválido o expirado.');

  const jobId = req.params && req.params.id;
  if (!jobId) return sendError(res, 400, 'invalid_payload', 'Request id is required.');

  try {
    const job = await loadJob(jobId);
    if (!job) return sendError(res, 404, 'not_found', 'Request not found.');

    // Allow employees to VIEW messages for:
    // - open requests (unassigned)
    // - requests assigned/claimed by them
    const isOpenUnassigned = job.status === STATUS.OPEN && !job.employeeId;
    const isMine = job.employeeId === employeeId;

    if (!isOpenUnassigned && !isMine) {
      return sendError(res, 403, 'forbidden', 'Insufficient permissions.');
    }

    const messages = await listMessages(jobId, { limit: req.query && req.query.limit });
    return res.status(200).json(messages.map(serializeMessage));
  } catch (err) {
    return handleError(res, err);
  }
}

async function postRequestMessage(req, res) {
  const employeeId = req.user && req.user.uid;
  if (!employeeId) return sendError(res, 401, 'invalid_token', 'Token inválido o expirado.');

  const jobId = req.params && req.params.id;
  if (!jobId) return sendError(res, 400, 'invalid_payload', 'Request id is required.');

  const text = req.body && req.body.text;
  if (typeof text !== 'string' || text.trim() === '') {
    return sendError(res, 400, 'invalid_payload', 'text is required.');
  }

  try {
    const job = await loadJob(jobId);
    if (!job) return sendError(res, 404, 'not_found', 'Request not found.');

    // Only allow posting if the request belongs to the employee (assigned/claimed).
    if (job.employeeId !== employeeId) {
      return sendError(res, 403, 'forbidden', 'Insufficient permissions.');
    }

    const message = await addMessage(jobId, {
      byUid: employeeId,
      byRole: 'employee',
      text,
    });

    return res.status(200).json(serializeMessage(message));
  } catch (err) {
    return handleError(res, err);
  }
}

async function postApplication(req, res) {
  const uid = req.user && req.user.uid;
  const email = req.user && req.user.email;
  const role = req.user && req.user.role;

  if (!uid || !email) return sendError(res, 401, 'invalid_token', 'Token inválido o expirado.');

  if (role === 'employee' || role === 'boss') {
    return sendError(res, 400, 'invalid_state', 'Esta cuenta ya tiene un rol activo.');
  }

  const { name, displayName, phone, address, photoUrl } = req.body || {};

  try {
    const application = await submitEmployeeApplication(uid, email, {
      name,
      displayName,
      phone,
      address,
      photoUrl,
    });
    return res.status(200).json(serializeEmployeeRequest(application));
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = {
  getDashboard,
  getRequests,
  claimRequest,
  getRequestMessages,
  postRequestMessage,
  postApplication,
};
