'use strict';

const crypto = require('crypto');

const { getNotificationSettings } = require('./notificationSettings.service');
const { logAction } = require('./auditLog.service');
const {
  normalizeE164,
  resolveWhatsAppTransportConfig,
  sendWhatsAppViaTwilio,
} = require('./whatsappNotifications.service');

const INTERNAL_WHATSAPP_WEBHOOK_PATH = '/api/hooks/whatsapp/send';

function cleanString(value, max = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function maskValue(value, { visibleStart = 3, visibleEnd = 4 } = {}) {
  const raw = cleanString(value, 300);
  if (!raw) return '';
  if (raw.length <= visibleStart + visibleEnd) return `${raw.slice(0, visibleStart)}***`;
  return `${raw.slice(0, visibleStart)}***${raw.slice(-visibleEnd)}`;
}

function maskPhone(value) {
  const normalized = normalizeE164(value);
  if (!normalized) return '';
  const digits = normalized.replace(/[^\d]/g, '');
  if (digits.length <= 4) return `+${digits}`;
  return `+${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeTimingEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (!a.length || !b.length || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function createRequestId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `whk_${crypto.randomBytes(16).toString('hex')}`;
}

function normalizeObject(input, { maxEntries = 20, maxKeyLength = 60, maxStringLength = 500 } = {}) {
  if (!isPlainObject(input)) return {};

  const result = {};
  for (const [rawKey, rawValue] of Object.entries(input).slice(0, maxEntries)) {
    const key = cleanString(rawKey, maxKeyLength);
    if (!key) continue;

    if (rawValue == null) {
      result[key] = null;
      continue;
    }

    if (typeof rawValue === 'string') {
      result[key] = cleanString(rawValue, maxStringLength);
      continue;
    }

    if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      result[key] = rawValue;
      continue;
    }

    if (Array.isArray(rawValue)) {
      result[key] = rawValue.slice(0, 10).map((entry) => {
        if (entry == null) return null;
        if (typeof entry === 'string') return cleanString(entry, maxStringLength);
        if (typeof entry === 'number' || typeof entry === 'boolean') return entry;
        return cleanString(JSON.stringify(entry), maxStringLength);
      });
      continue;
    }

    result[key] = cleanString(JSON.stringify(rawValue), maxStringLength);
  }

  return result;
}

function buildInternalWhatsAppWebhookStatus(settingsInput = {}) {
  const settings = settingsInput && typeof settingsInput === 'object'
    ? (settingsInput.whatsapp && typeof settingsInput.whatsapp === 'object' ? settingsInput.whatsapp : settingsInput)
    : {};

  const webhookToken = cleanString(settings.webhookToken || process.env.WHATSAPP_WEBHOOK_TOKEN, 300);
  const twilioTransport = resolveWhatsAppTransportConfig({
    transport: 'twilio',
    twilioAccountSid: settings.twilioAccountSid,
    twilioAuthToken: settings.twilioAuthToken,
    twilioWhatsAppFrom: settings.twilioWhatsAppFrom,
    twilioMessagingServiceSid: settings.twilioMessagingServiceSid,
    twilioStatusCallbackUrl: settings.twilioStatusCallbackUrl,
  });

  const dispatchModeRaw = cleanString(process.env.WHATSAPP_INTERNAL_WEBHOOK_MODE, 24).toLowerCase();
  const preferredMode = ['twilio', 'noop'].includes(dispatchModeRaw)
    ? dispatchModeRaw
    : (twilioTransport.configured ? 'twilio' : 'noop');
  const effectiveMode = preferredMode === 'twilio' && twilioTransport.configured ? 'twilio' : 'noop';

  const notes = [
    webhookToken
      ? 'El webhook interno exige Bearer token.'
      : 'Falta configurar webhookToken para autorizar el webhook interno.',
    effectiveMode === 'twilio'
      ? 'El webhook interno reenviara por Twilio usando las credenciales guardadas.'
      : 'El webhook interno quedara en simulacion hasta que existan credenciales Twilio validas.',
  ];

  return {
    service: 'internal_whatsapp_webhook',
    path: INTERNAL_WHATSAPP_WEBHOOK_PATH,
    authMode: 'bearer_token',
    hasWebhookToken: Boolean(webhookToken),
    webhookTokenMasked: webhookToken ? maskValue(webhookToken, { visibleStart: 4, visibleEnd: 4 }) : '',
    preferredMode,
    effectiveMode,
    twilioReady: Boolean(twilioTransport.configured),
    twilioConfigMissing: Array.isArray(twilioTransport.twilioConfigMissing) ? twilioTransport.twilioConfigMissing.slice() : [],
    ready: Boolean(webhookToken),
    deliveryReady: effectiveMode === 'twilio',
    notes,
  };
}

function getInternalWhatsAppWebhookUrl(baseUrl = '') {
  const base = cleanString(baseUrl, 2000).replace(/\/+$/, '');
  if (!base) return INTERNAL_WHATSAPP_WEBHOOK_PATH;
  return `${base}${INTERNAL_WHATSAPP_WEBHOOK_PATH}`;
}

function getWebhookBearerToken(headersInput = {}) {
  const headers = headersInput && typeof headersInput === 'object' ? headersInput : {};
  const authHeader = cleanString(headers.authorization || headers.Authorization, 500);
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return cleanString(headers['x-webhook-token'] || headers['X-Webhook-Token'], 300);
}

async function authorizeInternalWhatsAppWebhook(headersInput = {}) {
  const settings = await getNotificationSettings();
  const status = buildInternalWhatsAppWebhookStatus(settings);
  const providedToken = getWebhookBearerToken(headersInput);
  const expectedToken = cleanString(settings?.whatsapp?.webhookToken || process.env.WHATSAPP_WEBHOOK_TOKEN, 300);

  if (!expectedToken) {
    const error = new Error('Internal WhatsApp webhook token is not configured.');
    error.status = 503;
    error.code = 'webhook_not_configured';
    throw error;
  }

  if (!safeTimingEqual(providedToken, expectedToken)) {
    const error = new Error('Invalid webhook token.');
    error.status = 401;
    error.code = 'invalid_token';
    throw error;
  }

  return { settings, status };
}

function normalizeInternalWhatsAppWebhookPayload(input = {}) {
  const payload = isPlainObject(input) ? input : {};
  const to = normalizeE164(payload.to);
  if (!to) {
    const error = new Error('Webhook payload requires a valid destination phone in E.164 format.');
    error.status = 400;
    error.code = 'invalid_payload';
    throw error;
  }

  const text = cleanString(payload.text, 1200);
  if (!text) {
    const error = new Error('Webhook payload requires text.');
    error.status = 400;
    error.code = 'invalid_payload';
    throw error;
  }

  const sentAtRaw = cleanString(payload.sentAt, 80);
  const sentAtDate = sentAtRaw ? new Date(sentAtRaw) : null;

  return {
    requestId: cleanString(payload.requestId, 80) || createRequestId(),
    channel: 'whatsapp',
    eventType: cleanString(payload.eventType || 'system', 120).toLowerCase() || 'system',
    to,
    text,
    metadata: normalizeObject(payload.metadata, { maxEntries: 25, maxStringLength: 600 }),
    company: normalizeObject(payload.company, { maxEntries: 10, maxStringLength: 240 }),
    sentAt: sentAtDate && !Number.isNaN(sentAtDate.getTime()) ? sentAtDate.toISOString() : new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  };
}

async function dispatchInternalWhatsAppWebhook(payloadInput = {}, settingsInput = {}) {
  const payload = normalizeInternalWhatsAppWebhookPayload(payloadInput);
  const settings = settingsInput && typeof settingsInput === 'object' ? settingsInput : {};
  const status = buildInternalWhatsAppWebhookStatus(settings);

  let result;
  if (status.effectiveMode === 'twilio') {
    const transport = resolveWhatsAppTransportConfig({
      transport: 'twilio',
      twilioAccountSid: settings?.whatsapp?.twilioAccountSid,
      twilioAuthToken: settings?.whatsapp?.twilioAuthToken,
      twilioWhatsAppFrom: settings?.whatsapp?.twilioWhatsAppFrom,
      twilioMessagingServiceSid: settings?.whatsapp?.twilioMessagingServiceSid,
      twilioStatusCallbackUrl: settings?.whatsapp?.twilioStatusCallbackUrl,
    });

    result = await sendWhatsAppViaTwilio(payload, transport);
  } else {
    result = {
      ok: true,
      status: 'simulated',
      provider: 'internal-webhook',
      relayMode: 'noop',
      message: 'Webhook interno procesado en modo simulado.',
    };
  }

  const enriched = {
    ...result,
    requestId: payload.requestId,
    channel: 'whatsapp',
    eventType: payload.eventType,
    relayMode: status.effectiveMode,
    to: maskPhone(payload.to),
    acceptedAt: new Date().toISOString(),
  };

  await logAction({
    actorId: 'internal-whatsapp-webhook',
    role: 'system',
    action: enriched.ok ? 'whatsapp_webhook_processed' : 'whatsapp_webhook_failed',
    targetId: payload.requestId,
    meta: {
      relayMode: enriched.relayMode,
      eventType: payload.eventType,
      to: enriched.to,
      provider: cleanString(enriched.provider || 'internal-webhook', 80),
      providerStatus: cleanString(enriched.status || '', 40),
      ok: Boolean(enriched.ok),
    },
  }).catch((error) => {
    console.warn('[internal-whatsapp-webhook] Audit log failed:', error && error.message ? error.message : error);
  });

  return enriched;
}

module.exports = {
  INTERNAL_WHATSAPP_WEBHOOK_PATH,
  authorizeInternalWhatsAppWebhook,
  buildInternalWhatsAppWebhookStatus,
  dispatchInternalWhatsAppWebhook,
  getInternalWhatsAppWebhookUrl,
  normalizeInternalWhatsAppWebhookPayload,
};
