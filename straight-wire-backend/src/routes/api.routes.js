'use strict';

// API routes for employee panel and boss assignments.

const express = require('express');

const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const requireRole = require('../middleware/requireRole');
const {
  postClientCreateRequest,
  getClientActiveRequest,
  getClientRequestsHistory,
  getBossRequests,
  getEmployeeRequests,
  postBossAssignRequest,
  postEmployeeClaimRequest,
  postEmployeeSubmitProof,
  postEmployeeMarkAwaiting,
  postClientConfirmRequest,
  postBossCloseRequest,
  patchBossForce,
  postBossForceClose,
  getEmployeeProfileForClient,
  postClientUploadPhoto,
} = require('../controllers/clientRequests.controller');
const { debugState } = require('../controllers/debug.controller');

const router = express.Router();

// Client
router.post('/client/requests', verifyFirebaseToken, requireRole('client'), postClientCreateRequest);
router.get('/client/requests/active', verifyFirebaseToken, requireRole('client'), getClientActiveRequest);
router.get('/client/requests', verifyFirebaseToken, requireRole('client'), getClientRequestsHistory);
router.post('/client/requests/:id/confirm', verifyFirebaseToken, requireRole('client'), postClientConfirmRequest);
router.post('/client/requests/:id/approve', verifyFirebaseToken, requireRole('client'), postClientConfirmRequest); // legacy alias
router.post('/client/requests/:id/ok', verifyFirebaseToken, requireRole('client'), postClientConfirmRequest); // legacy alias
router.post('/client/requests/:id/photo', verifyFirebaseToken, requireRole('client'), postClientUploadPhoto);

// Employee
router.get('/employee/requests', verifyFirebaseToken, requireRole(['employee', 'boss']), getEmployeeRequests);
router.post('/employee/requests/:id/claim', verifyFirebaseToken, requireRole('employee'), postEmployeeClaimRequest);
router.post('/employee/requests/:id/submit-proof', verifyFirebaseToken, requireRole('employee'), postEmployeeSubmitProof);
router.post(
  '/employee/requests/:id/mark-awaiting-client',
  verifyFirebaseToken,
  requireRole('employee'),
  postEmployeeMarkAwaiting,
);
router.post('/employee/requests/:id/complete', verifyFirebaseToken, requireRole('employee'), postEmployeeMarkAwaiting);

// Boss
router.get('/boss/requests', verifyFirebaseToken, requireRole('boss'), getBossRequests);
router.post('/boss/assign-request', verifyFirebaseToken, requireRole('boss'), postBossAssignRequest);
router.post('/boss/requests/:id/close', verifyFirebaseToken, requireRole('boss'), postBossCloseRequest);
router.patch('/boss/requests/:id/force', verifyFirebaseToken, requireRole('boss'), patchBossForce);
router.post('/boss/requests/:id/force-close', verifyFirebaseToken, requireRole('boss'), postBossForceClose);

// Profiles
router.get(
  '/employee/profile/:employeeUid',
  verifyFirebaseToken,
  requireRole(['client', 'employee', 'boss']),
  getEmployeeProfileForClient,
);

// Debug
router.get('/debug/state', verifyFirebaseToken, requireRole('boss'), debugState);

module.exports = router;
