'use strict';

// Employee routes (frontend contract).
//
// Endpoints:
// - GET  /employee/dashboard
// - GET  /employee/requests
// - POST /employee/requests/:id/claim
// - POST /employee/applications
//
// NOTE: Chat messages are now handled via /api/marketplace/requests/:id/chat (REST)
//       Legacy /messages routes have been deprecated.

const express = require('express');

const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const requireRole = require('../middleware/requireRole');

const {
  getDashboard,
  getRequests,
  claimRequest,
  // getRequestMessages, // DEPRECATED - use /api/marketplace/requests/:id/chat
  // postRequestMessage, // DEPRECATED - use /api/marketplace/requests/:id/chat
  postApplication,
} = require('../controllers/employee.controller');

const router = express.Router();

router.use(verifyFirebaseToken);

router.get('/dashboard', requireRole('employee'), getDashboard);
router.get('/requests', requireRole('employee'), getRequests);
router.post('/requests/:id/claim', requireRole('employee'), claimRequest);

// DEPRECATED: Legacy chat routes - use /api/marketplace/requests/:id/chat instead
// router.get('/requests/:id/messages', requireRole('employee'), getRequestMessages);
// router.post('/requests/:id/messages', requireRole('employee'), postRequestMessage);

router.post('/applications', postApplication);

module.exports = router;
