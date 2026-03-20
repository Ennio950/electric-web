'use strict';

// Employee Jobs API controllers (backend-first).

const {
  listEmployeeJobsByFilter,
  acceptJobForStaff,
  updateJobStatusForStaff,
} = require('../services/jobs.service');

function sendError(res, status, error, message) {
  return res.status(status).json({ ok: false, error, message });
}

function handleError(res, err) {
  const status = err && typeof err.status === 'number' ? err.status : 500;
  const error = err && typeof err.code === 'string' ? err.code.toLowerCase() : 'internal_error';
  const message = status >= 500 ? 'Internal Server Error' : err.message || 'Request failed.';
  return sendError(res, status, error, message);
}

function resolveDisplayName(user) {
  if (!user || typeof user !== 'object') return null;
  if (typeof user.name === 'string' && user.name.trim() !== '') return user.name.trim();
  if (typeof user.displayName === 'string' && user.displayName.trim() !== '') return user.displayName.trim();
  return null;
}

function emitJobUpdated(req, job) {
  const io = req.app && req.app.get('io');
  if (!io || !job) return;
  io.to('employees').emit('job:updated', job);
  if (job.id) {
    io.to(`job:${job.id}`).emit('job:updated', job);
  }
}

async function listJobs(req, res) {
  const uid = req.user && req.user.uid;
  if (!uid) return sendError(res, 401, 'unauthorized', 'Authentication required.');

  const filter = req.query && req.query.filter;

  try {
    const jobs = await listEmployeeJobsByFilter(filter, uid, { limit: req.query && req.query.limit });
    return res.status(200).json({ ok: true, data: jobs });
  } catch (err) {
    return handleError(res, err);
  }
}

async function acceptJob(req, res) {
  const uid = req.user && req.user.uid;
  if (!uid) return sendError(res, 401, 'unauthorized', 'Authentication required.');

  const jobId = req.params && req.params.jobId;
  if (!jobId) return sendError(res, 400, 'invalid_payload', 'jobId is required.');

  try {
    const job = await acceptJobForStaff(jobId, {
      uid,
      email: req.user && req.user.email,
      name: resolveDisplayName(req.user),
    });
    emitJobUpdated(req, job);
    return res.status(200).json({ ok: true, data: job });
  } catch (err) {
    return handleError(res, err);
  }
}

async function updateStatus(req, res) {
  const uid = req.user && req.user.uid;
  if (!uid) return sendError(res, 401, 'unauthorized', 'Authentication required.');

  const jobId = req.params && req.params.jobId;
  if (!jobId) return sendError(res, 400, 'invalid_payload', 'jobId is required.');

  const status = typeof req.body?.status === 'string' ? req.body.status.trim().toLowerCase() : '';
  if (!status) return sendError(res, 400, 'invalid_payload', 'status is required.');

  try {
    const job = await updateJobStatusForStaff(jobId, { uid, role: req.user && req.user.role }, status);
    emitJobUpdated(req, job);
    return res.status(200).json({ ok: true, data: job });
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = {
  listJobs,
  acceptJob,
  updateStatus,
};
