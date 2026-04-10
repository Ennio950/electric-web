'use strict';

// Client Jobs API controllers (backend-first).

const { createJobForClientApi, listClientJobs } = require('../services/jobs.service');
const { sendApiError, handleApiError } = require('../utils/controllerErrors');


function normalizeUrgency(value) {
  if (typeof value !== 'string' || value.trim() === '') return 'normal';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'normal' || normalized === 'urgent') return normalized;
  return null;
}

function emitJobCreated(req, job) {
  const io = req.app && req.app.get('io');
  if (!io || !job) return;
  io.to('employees').emit('job:created', job);
}

async function createJob(req, res) {
  const uid = req.user && req.user.uid;
  if (!uid) return sendApiError(res, 401, 'unauthorized', 'Authentication required.');

  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  if (!description) return sendApiError(res, 400, 'invalid_payload', 'description is required.');

  const urgency = normalizeUrgency(req.body?.urgency);
  if (!urgency) return sendApiError(res, 400, 'invalid_payload', 'urgency must be normal | urgent.');

  try {
    const job = await createJobForClientApi(uid, {
      clientEmail: req.user && req.user.email,
      description,
      urgency,
    });
    emitJobCreated(req, job);
    return res.status(201).json({ ok: true, data: job });
  } catch (err) {
    return handleApiError(res, err);
  }
}

async function listJobs(req, res) {
  const uid = req.user && req.user.uid;
  if (!uid) return sendApiError(res, 401, 'unauthorized', 'Authentication required.');

  try {
    const jobs = await listClientJobs(uid, { limit: req.query && req.query.limit });
    return res.status(200).json({ ok: true, data: jobs });
  } catch (err) {
    return handleApiError(res, err);
  }
}

module.exports = {
  createJob,
  listJobs,
};
