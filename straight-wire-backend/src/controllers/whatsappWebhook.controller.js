'use strict';

const { z } = require('zod');

const { getNotificationSettings } = require('../services/notificationSettings.service');
const {
  authorizeInternalWhatsAppWebhook,
  buildInternalWhatsAppWebhookStatus,
  dispatchInternalWhatsAppWebhook,
} = require('../services/internalWhatsAppWebhook.service');

function sendError(res, status, error, message) {
  return res.status(status).json({ error, message });
}

function handleError(res, err) {
  const status = err && typeof err.status === 'number' ? err.status : 500;
  const error = err && typeof err.code === 'string' ? err.code : 'internal_error';
  const message = status >= 500 ? 'Internal Server Error' : err.message || 'Request failed.';
  return sendError(res, status, String(error).toLowerCase(), message);
}

const webhookPayloadSchema = z.object({
  requestId: z.string().trim().max(80).optional(),
  channel: z.string().trim().max(40).optional(),
  eventType: z.string().trim().max(120).optional(),
  to: z.string().trim().max(40),
  text: z.string().trim().max(1200),
  metadata: z.record(z.string(), z.any()).optional(),
  company: z.record(z.string(), z.any()).optional(),
  sentAt: z.string().trim().max(80).optional(),
});

async function getInternalWhatsAppWebhookInfo(req, res) {
  try {
    const settings = await getNotificationSettings();
    const status = buildInternalWhatsAppWebhookStatus(settings);
    return res.status(200).json({
      ok: true,
      data: status,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

async function receiveInternalWhatsAppWebhook(req, res) {
  let input;
  try {
    input = webhookPayloadSchema.parse(req.body || {});
  } catch (_) {
    return sendError(res, 400, 'invalid_payload', 'Invalid WhatsApp webhook payload.');
  }

  try {
    const { settings } = await authorizeInternalWhatsAppWebhook(req.headers || {});
    const result = await dispatchInternalWhatsAppWebhook(input, settings);
    const statusCode = result && result.ok ? 200 : 502;

    return res.status(statusCode).json({
      ok: Boolean(result && result.ok),
      data: result,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = {
  getInternalWhatsAppWebhookInfo,
  receiveInternalWhatsAppWebhook,
};
