'use strict';

const { admin, db } = require('../firebase');

const SYSTEM_COLLECTION = 'system';
const NOTIFICATION_SETTINGS_DOC = 'notificationSettings';

function cleanString(value, max = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function normalizeE164(value) {
  const raw = cleanString(value, 40);
  if (!raw) return '';
  let normalized = raw.replace(/[^\d+]/g, '');
  if (normalized.startsWith('00')) normalized = `+${normalized.slice(2)}`;
  if (!normalized.startsWith('+')) normalized = `+${normalized.replace(/[+]/g, '')}`;
  const digits = normalized.replace(/[^\d]/g, '');
  if (digits.length < 8 || digits.length > 15) return '';
  return `+${digits}`;
}

function normalizeTransport(value, allowed, fallback) {
  const raw = cleanString(value, 40).toLowerCase();
  return allowed.includes(raw) ? raw : fallback;
}

function normalizeTelegramChatId(value) {
  const raw = cleanString(value, 120);
  if (!raw) return '';
  if (/^-?\d{6,20}$/.test(raw)) return raw;
  if (/^@[a-zA-Z0-9_]{5,}$/.test(raw)) return raw;
  return '';
}

function normalizeWhatsAppFrom(value) {
  const raw = cleanString(value, 80);
  if (!raw) return '';
  const clean = raw.toLowerCase().startsWith('whatsapp:') ? raw.slice('whatsapp:'.length) : raw;
  const e164 = normalizeE164(clean);
  return e164 ? `whatsapp:${e164}` : '';
}

function maskValue(value, options = {}) {
  const raw = cleanString(value, options.max || 240);
  if (!raw) return '';
  const visibleStart = Number(options.visibleStart || 3);
  const visibleEnd = Number(options.visibleEnd || 4);
  if (raw.length <= visibleStart + visibleEnd) return `${raw.slice(0, visibleStart)}***`;
  return `${raw.slice(0, visibleStart)}***${raw.slice(-visibleEnd)}`;
}

function cloneDefaults() {
  return {
    whatsapp: {
      alertNumber: '',
      transport: normalizeTransport(process.env.WHATSAPP_TRANSPORT || 'noop', ['noop', 'webhook', 'twilio'], 'noop'),
      webhookUrl: cleanString(process.env.WHATSAPP_WEBHOOK_URL, 2000),
      webhookToken: cleanString(process.env.WHATSAPP_WEBHOOK_TOKEN, 300),
      twilioAccountSid: cleanString(process.env.TWILIO_ACCOUNT_SID, 120),
      twilioAuthToken: cleanString(process.env.TWILIO_AUTH_TOKEN, 240),
      twilioWhatsAppFrom: normalizeWhatsAppFrom(process.env.TWILIO_WHATSAPP_FROM),
      twilioMessagingServiceSid: cleanString(process.env.TWILIO_MESSAGING_SERVICE_SID, 80),
      twilioStatusCallbackUrl: cleanString(process.env.TWILIO_WHATSAPP_STATUS_CALLBACK_URL, 2000),
    },
    telegram: {
      transport: normalizeTransport(process.env.TELEGRAM_TRANSPORT || 'disabled', ['disabled', 'noop', 'api'], 'disabled'),
      botToken: cleanString(process.env.TELEGRAM_BOT_TOKEN, 400),
      defaultChatId: normalizeTelegramChatId(process.env.TELEGRAM_DEFAULT_CHAT_ID),
    },
  };
}

function normalizeWhatsAppSettings(input = {}, fallback = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const base = fallback && typeof fallback === 'object' ? fallback : {};

  const next = {
    alertNumber: normalizeE164(source.alertNumber || base.alertNumber),
    transport: normalizeTransport(source.transport || base.transport || 'noop', ['noop', 'webhook', 'twilio'], 'noop'),
    webhookUrl: cleanString(source.webhookUrl || base.webhookUrl, 2000),
    webhookToken: cleanString(source.webhookToken || base.webhookToken, 300),
    twilioAccountSid: cleanString(source.twilioAccountSid || base.twilioAccountSid, 120),
    twilioAuthToken: cleanString(source.twilioAuthToken || base.twilioAuthToken, 240),
    twilioWhatsAppFrom: normalizeWhatsAppFrom(source.twilioWhatsAppFrom || base.twilioWhatsAppFrom),
    twilioMessagingServiceSid: cleanString(source.twilioMessagingServiceSid || base.twilioMessagingServiceSid, 80),
    twilioStatusCallbackUrl: cleanString(source.twilioStatusCallbackUrl || base.twilioStatusCallbackUrl, 2000),
  };

  return next;
}

function normalizeTelegramSettings(input = {}, fallback = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const base = fallback && typeof fallback === 'object' ? fallback : {};

  return {
    transport: normalizeTransport(source.transport || base.transport || 'disabled', ['disabled', 'noop', 'api'], 'disabled'),
    botToken: cleanString(source.botToken || base.botToken, 400),
    defaultChatId: normalizeTelegramChatId(source.defaultChatId || base.defaultChatId),
  };
}

function mergeNotificationSettings(...sources) {
  let result = cloneDefaults();

  sources.forEach((source) => {
    if (!source || typeof source !== 'object') return;
    result = {
      whatsapp: normalizeWhatsAppSettings(source.whatsapp, result.whatsapp),
      telegram: normalizeTelegramSettings(source.telegram, result.telegram),
    };
  });

  return result;
}

async function getStoredNotificationSettings() {
  const snap = await db.collection(SYSTEM_COLLECTION).doc(NOTIFICATION_SETTINGS_DOC).get();
  return snap.exists ? (snap.data() || {}) : {};
}

async function getNotificationSettings() {
  const stored = await getStoredNotificationSettings();
  return mergeNotificationSettings(stored);
}

async function updateNotificationSettings(patch = {}, meta = {}) {
  const currentStored = await getStoredNotificationSettings();
  const merged = mergeNotificationSettings(currentStored, patch);

  await db.collection(SYSTEM_COLLECTION).doc(NOTIFICATION_SETTINGS_DOC).set(
    {
      ...merged,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: meta && meta.uid ? String(meta.uid).trim() : null,
    },
    { merge: true },
  );

  return getNotificationSettings();
}

function sanitizeNotificationSettingsForBoss(settingsInput = {}) {
  const settings = mergeNotificationSettings(settingsInput);
  return {
    whatsapp: {
      alertNumber: settings.whatsapp.alertNumber,
      transport: settings.whatsapp.transport,
      webhookUrl: settings.whatsapp.webhookUrl,
      webhookTokenMasked: settings.whatsapp.webhookToken ? maskValue(settings.whatsapp.webhookToken, { visibleStart: 2, visibleEnd: 3 }) : '',
      hasWebhookToken: Boolean(settings.whatsapp.webhookToken),
      twilioAccountSid: settings.whatsapp.twilioAccountSid,
      twilioAuthTokenMasked: settings.whatsapp.twilioAuthToken ? maskValue(settings.whatsapp.twilioAuthToken, { visibleStart: 2, visibleEnd: 3 }) : '',
      hasTwilioAuthToken: Boolean(settings.whatsapp.twilioAuthToken),
      twilioWhatsAppFrom: settings.whatsapp.twilioWhatsAppFrom,
      twilioMessagingServiceSid: settings.whatsapp.twilioMessagingServiceSid,
      twilioStatusCallbackUrl: settings.whatsapp.twilioStatusCallbackUrl,
    },
    telegram: {
      transport: settings.telegram.transport,
      botTokenMasked: settings.telegram.botToken ? maskValue(settings.telegram.botToken, { visibleStart: 4, visibleEnd: 4 }) : '',
      hasBotToken: Boolean(settings.telegram.botToken),
      defaultChatId: settings.telegram.defaultChatId,
    },
  };
}

module.exports = {
  mergeNotificationSettings,
  getNotificationSettings,
  updateNotificationSettings,
  sanitizeNotificationSettingsForBoss,
};
