'use strict';

const express = require('express');

const {
  getInternalWhatsAppWebhookInfo,
  receiveInternalWhatsAppWebhook,
} = require('../controllers/whatsappWebhook.controller');

const router = express.Router();

router.get('/', getInternalWhatsAppWebhookInfo);
router.post('/send', receiveInternalWhatsAppWebhook);

module.exports = router;
