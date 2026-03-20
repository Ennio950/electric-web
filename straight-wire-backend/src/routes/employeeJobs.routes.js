'use strict';

// Employee Jobs API routes (backend-first).

const express = require('express');

const auth = require('../middleware/auth');
const { requireStaff } = require('../middleware/requireRole');
const { listJobs, acceptJob, updateStatus } = require('../controllers/employeeJobs.controller');

const router = express.Router();

router.get('/jobs', auth.flat, requireStaff, listJobs);
router.post('/jobs/:jobId/accept', auth.flat, requireStaff, acceptJob);
router.post('/jobs/:jobId/status', auth.flat, requireStaff, updateStatus);

module.exports = router;
