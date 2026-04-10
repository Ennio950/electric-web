'use strict';

// Boss routes (frontend contract).
// Mounted under /boss from src/index.js (verifyFirebaseToken + requireRole('boss') are applied there).

const express = require('express');

const {
  getRequests,
  assignRequest,
  getEmployeeRequests,
  approveEmployeeRequest,
  rejectEmployeeRequest,
  getPhotoChangeRequests,
  approvePhotoChangeRequest,
  rejectPhotoChangeRequest,
  getMe,
  getBossCompanyConfig,
  updateBossCompanyConfig,
  getBossNotificationSettings,
  updateBossNotificationSettings,
  getBossNotificationChannels,
  sendBossWhatsappTest,
  sendBossTelegramTest,
} = require('../controllers/boss.controller');

const router = express.Router();

// GET /api/boss/me - role validation endpoint for role-gateway
router.get('/me', getMe);
router.get('/company-config', getBossCompanyConfig);
router.put('/company-config', updateBossCompanyConfig);
router.get('/notifications/settings', getBossNotificationSettings);
router.put('/notifications/settings', updateBossNotificationSettings);
router.get('/notifications/channels', getBossNotificationChannels);
router.post('/notifications/whatsapp/test', sendBossWhatsappTest);
router.post('/notifications/telegram/test', sendBossTelegramTest);

router.get('/requests', getRequests);
router.post('/requests/:id/assign', assignRequest);

router.get('/employee-requests', getEmployeeRequests);
router.post('/employee-requests/:id/approve', approveEmployeeRequest);
router.post('/employee-requests/:id/reject', rejectEmployeeRequest);

router.get('/photo-change-requests', getPhotoChangeRequests);
router.post('/photo-change-requests/:id/approve', approvePhotoChangeRequest);
router.post('/photo-change-requests/:id/reject', rejectPhotoChangeRequest);

module.exports = router;
