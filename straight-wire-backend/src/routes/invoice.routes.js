'use strict';

const express = require('express');
const router = express.Router();

const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const requireRole = require('../middleware/requireRole');
const controller = require('../controllers/invoice.controller');

router.use(verifyFirebaseToken);
router.use(requireRole(['employee', 'boss']));

router.get('/', controller.listInvoices);
router.post('/', controller.createInvoice);
router.get('/:invoiceId/pdf', controller.getInvoicePdf);

module.exports = router;
