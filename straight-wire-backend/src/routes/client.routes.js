'use strict';

// Client routes (frontend contract).
//
// Endpoints:
// - POST /client/register
// - POST /client/requests
// - GET  /client/requests/latest
// - GET  /client/requests/:id
// - POST /client/requests/:id/close
//
// NOTE: Chat messages are now handled via /api/marketplace/requests/:id/chat (REST)
//       Legacy /messages routes have been deprecated.

const express = require('express');

const auth = require('../middleware/auth');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const requireRole = require('../middleware/requireRole');

const {
  register,
  createRequest,
  getLatestRequest,
  getRequestById,
  closeRequest,
  // getRequestMessages, // DEPRECATED - use /api/marketplace/requests/:id/chat
  // postRequestMessage, // DEPRECATED - use /api/marketplace/requests/:id/chat
  getMe,
} = require('../controllers/client.controller');
const { createJob, listJobs } = require('../controllers/clientJobs.controller');

const router = express.Router();

// GET /api/client/me - role validation endpoint for role-gateway
router.get('/me', verifyFirebaseToken, requireRole('client'), getMe);

router.post('/register', register);

// Canonical jobs contract for /api/client/jobs.
router.get('/jobs', auth.flat, requireRole.requireClient, listJobs);
router.post('/jobs', auth.flat, requireRole.requireClient, createJob);

router.post('/requests', verifyFirebaseToken, requireRole('client'), createRequest);
router.get('/requests/latest', verifyFirebaseToken, requireRole('client'), getLatestRequest);
router.get('/requests/:id', verifyFirebaseToken, requireRole('client'), getRequestById);
router.post('/requests/:id/close', verifyFirebaseToken, requireRole('client'), closeRequest);

// DEPRECATED: Legacy chat routes - use /api/marketplace/requests/:id/chat instead
// router.get('/requests/:id/messages', verifyFirebaseToken, requireRole('client'), getRequestMessages);
// router.post('/requests/:id/messages', verifyFirebaseToken, requireRole('client'), postRequestMessage);

module.exports = router;
