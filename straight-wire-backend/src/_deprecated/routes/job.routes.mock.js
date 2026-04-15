'use strict';

// DEPRECATED: This in-memory mock has been replaced by Firestore-backed routes.
// Kept for reference only; do not mount in production.

// Mock Jobs API (in-memory).
// NOTE: This is a temporary implementation. Data resets on server restart.
// Auth/roles are handled at the app mounting level in `src/index.js`.

const express = require('express');

const router = express.Router();

// In-memory mock "database"
const JOBS = [];
let nextJobId = 1;

function sendOk(res, data) {
  return res.status(200).json({ ok: true, data });
}

function sendError(res, status, code, message) {
  return res.status(status).json({
    ok: false,
    error: { code, message },
  });
}

function createJob(title) {
  const job = {
    id: String(nextJobId++),
    title,
    status: 'open',
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  JOBS.push(job);
  return job;
}

function findJobById(id) {
  return JOBS.find((job) => job.id === id) || null;
}

/* =========================
   CLIENT
========================= */

// GET /api/client/jobs
router.get('/client/jobs', (req, res) => {
  return sendOk(res, JOBS);
});

// POST /api/client/jobs
// Body: { "title": "string" }
router.post('/client/jobs', (req, res) => {
  const title = req.body && req.body.title;
  if (typeof title !== 'string' || title.trim() === '') {
    return sendError(res, 400, 'INVALID_INPUT', 'title must be a non-empty string.');
  }

  const job = createJob(title.trim());
  return sendOk(res, job);
});

/* =========================
   EMPLOYEE
========================= */

// GET /api/employee/jobs
router.get('/employee/jobs', (req, res) => {
  return sendOk(res, JOBS);
});

// POST /api/employee/jobs/:id/complete
router.post('/employee/jobs/:id/complete', (req, res) => {
  const jobId = req.params && req.params.id;
  const job = findJobById(jobId);

  if (!job) {
    return sendError(res, 404, 'NOT_FOUND', 'Job not found.');
  }

  if (job.status !== 'completed') {
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
  }

  return sendOk(res, job);
});

/* =========================
   BOSS
========================= */

// GET /api/boss/jobs
router.get('/boss/jobs', (req, res) => {
  return sendOk(res, JOBS);
});

module.exports = router;
