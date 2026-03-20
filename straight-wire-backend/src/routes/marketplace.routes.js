'use strict';

/**
 * Marketplace Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');

const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const requireRole = require('../middleware/requireRole');
const controller = require('../controllers/marketplace.controller');

// Upload Config
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF'), false);
        }
    }
});

// All marketplace routes require authentication
router.use(verifyFirebaseToken);

// ============================================================
// Client Routes
// ============================================================

router.post('/requests', requireRole('client'), controller.createRequest);
router.post('/emergency-calls', requireRole('client'), controller.createEmergencyCall);
router.get('/requests', requireRole('client'), controller.listClientRequests);
router.get('/emergency-calls', requireRole(['client', 'employee', 'boss']), controller.listEmergencyCalls);
router.get('/emergency-calls/:id', requireRole(['client', 'employee', 'boss']), controller.getEmergencyCall);
router.get('/requests/available', requireRole(['employee', 'boss']), controller.listAvailableRequests);
router.get('/requests/:id', requireRole(['client', 'employee', 'boss']), controller.getRequest);
router.delete('/requests/:id', requireRole('client'), controller.cancelRequest);

router.post('/requests/:id/accept-proposal', requireRole('client'), controller.acceptProposal);
router.post('/requests/:id/reject-proposal', requireRole('client'), controller.rejectProposal);
router.post('/requests/:id/close', requireRole('client'), controller.clientClose);
router.post('/requests/:id/payment-proof', requireRole(['client', 'employee']), controller.submitPaymentProof);
router.post('/requests/:id/notify-boss-payment', requireRole('employee'), controller.notifyBossPaymentReview);
router.post('/emergency-calls/:id/close', requireRole('client'), controller.clientCloseEmergencyCall);
router.get('/requests/:id/estimate-url', requireRole(['client', 'boss']), controller.getEstimateUrl); // Secure PDF Link

// ============================================================
// Employee Routes
// ============================================================

router.get('/employee/my-requests', requireRole(['employee', 'boss']), controller.listEmployeeRequests);
router.get('/employee/active-job', requireRole(['employee', 'boss']), controller.getActiveJob);
router.post('/quote-number/next', requireRole(['employee', 'boss']), controller.getNextQuoteNumber);

router.post('/requests/:id/claim', requireRole(['employee', 'boss']), controller.claimRequest);
router.post('/requests/:id/release', requireRole(['employee', 'boss']), controller.releaseClaim);
router.post('/emergency-calls/:id/accept', requireRole(['employee', 'boss']), controller.acceptEmergencyCall);
router.post('/emergency-calls/:id/resolve', requireRole(['employee', 'boss']), controller.resolveEmergencyCall);
router.post('/emergency-calls/:id/payment-proof', requireRole('employee'), controller.submitEmergencyPaymentProof);
router.post('/emergency-calls/:id/notify-boss-payment', requireRole('employee'), controller.notifyBossEmergencyPaymentReview);
router.post('/emergency-calls/:id/location', requireRole(['client', 'employee', 'boss']), controller.updateEmergencyLocation);
router.delete('/emergency-calls/:id', requireRole(['employee', 'boss']), controller.deleteEmergencyCall);
router.post('/requests/:id/proposal', requireRole(['employee', 'boss']), controller.sendProposal);
router.post('/requests/:id/finish', requireRole(['employee', 'boss']), controller.markFinished);
router.post('/render-estimate', requireRole(['employee', 'boss']), controller.renderEstimatePdf);

router.post(
    '/upload-estimate',
    requireRole(['employee', 'boss']),
    upload.single('file'),
    controller.uploadEstimate
);

// ============================================================
// Boss Routes
// ============================================================

router.get('/boss/requests', requireRole('boss'), controller.listAllRequests);
router.get('/boss/employees', requireRole('boss'), controller.listBossEmployees);
router.get('/boss/payments/pending', requireRole('boss'), controller.listPendingPayments);
router.get('/boss/review-queue', requireRole('boss'), controller.listBossReviewQueue);

// Earnings endpoint
const earningsController = require('../controllers/earnings.controller');
router.get('/boss/earnings', requireRole('boss'), earningsController.getEarnings);

router.post('/requests/:id/approve-payment', requireRole('boss'), controller.approvePayment);
router.post('/requests/:id/reject-payment', requireRole('boss'), controller.rejectPayment);
router.post('/boss/requests/:id/assign', requireRole('boss'), controller.assignRequestToEmployee);
router.post('/boss/requests/:id/unassign', requireRole('boss'), controller.unassignRequestByBoss);
router.post('/boss/emergency-calls/:id/assign', requireRole('boss'), controller.assignEmergencyCallToEmployee);
router.post('/emergency-calls/:id/approve-payment', requireRole('boss'), controller.approveEmergencyPayment);
router.post('/emergency-calls/:id/reject-payment', requireRole('boss'), controller.rejectEmergencyPayment);

// ============================================================
// Chat Routes
// ============================================================

router.get('/requests/:id/chat', requireRole(['client', 'employee', 'boss']), controller.listChatMessages);
router.post('/requests/:id/chat', requireRole(['client', 'employee', 'boss']), controller.sendChatMessage);
router.get('/emergency-calls/:id/chat', requireRole(['client', 'employee', 'boss']), controller.listEmergencyChatMessages);
router.post('/emergency-calls/:id/chat', requireRole(['client', 'employee', 'boss']), controller.sendEmergencyChatMessage);

module.exports = router;
