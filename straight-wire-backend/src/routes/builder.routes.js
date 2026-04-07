'use strict';

const express = require('express');
const router = express.Router();

const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const requireRole = require('../middleware/requireRole');
const controller = require('../controllers/builder.controller');

router.use(verifyFirebaseToken);

// List saved estimates for the current user (or all, for boss)
router.get('/estimates', requireRole(['employee', 'boss']), controller.listEstimates);

// Create and persist a builder estimate, allocating a quote number
router.post('/estimates', requireRole(['employee', 'boss']), controller.createEstimate);

// Download the PDF for a stored estimate (GET so FileSystem.downloadAsync works)
router.get('/estimates/:estimateId/pdf', requireRole(['employee', 'boss']), controller.getEstimatePdf);

// Link a stored estimate to a marketplace request
router.post('/estimates/:estimateId/link-request', requireRole(['employee', 'boss']), controller.linkEstimateToRequest);

module.exports = router;
