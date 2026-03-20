'use strict';

function cleanString(value, max = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function normalizeTelegramChatId(value) {
  const raw = cleanString(value, 120);
  if (!raw) return '';
  if (/^-?\d{6,20}$/.test(raw)) return raw;
  if (/^@[a-zA-Z0-9_]{5,}$/.test(raw)) return raw;
  return '';
}

function maskChatId(value) {
  const normalized = normalizeTelegramChatId(value);
  if (!normalized) return '';
  if (normalized.startsWith('@')) return `${normalized.slice(0, 3)}***`;
  const sign = normalized.startsWith('-') ? '-' : '';
  const digits = normalized.replace(/^-/, '');
  if (digits.length <= 4) return `${sign}${digits}`;
  return `${sign}${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function resolveTelegramConfig(settingsInput = {}) {
  const settings = settingsInput && typeof settingsInput === 'object'
    ? (settingsInput.telegram && typeof settingsInput.telegram === 'object' ? settingsInput.telegram : settingsInput)
    : {};

  const token = cleanString(settings.botToken || process.env.TELEGRAM_BOT_TOKEN, 400);
  const defaultChatId = normalizeTelegramChatId(settings.defaultChatId || process.env.TELEGRAM_DEFAULT_CHAT_ID);
  const transportRaw = cleanString(settings.transport || process.env.TELEGRAM_TRANSPORT, 24).toLowerCase();
  const transport = ['api', 'noop', 'disabled'].includes(transportRaw)
    ? transportRaw
    : (token ? 'api' : 'disabled');

  return {
    token,
    defaultChatId,
    transport,
    configured: transport === 'noop' ? true : (transport === 'api' ? Boolean(token) : false),
  };
}

function getTelegramChannelStatus(settingsInput = {}) {
  const config = resolveTelegramConfig(settingsInput);
  const simulated = config.transport === 'noop';
  const deliveryReady = config.transport === 'api' && config.configured;
  const ready = Boolean(config.defaultChatId) && deliveryReady;

  return {
    channel: 'telegram',
    transport: config.transport,
    transportConfigured: config.configured,
    simulated,
    deliveryReady,
    hasConfiguredRecipient: Boolean(config.defaultChatId),
    configuredRecipientPreview: config.defaultChatId ? maskChatId(config.defaultChatId) : '',
    ready,
    mode: simulated ? 'simulado' : (deliveryReady ? 'activo' : 'deshabilitado'),
    notes: [
      config.transport === 'api'
        ? 'TELEGRAM_BOT_TOKEN configurado para envio real.'
        : (config.transport === 'noop'
          ? 'TELEGRAM_TRANSPORT=noop (simulacion sin envio real).'
          : 'TELEGRAM_TRANSPORT=disabled (canal deshabilitado).'),
      config.defaultChatId
        ? 'Destino por defecto configurado (TELEGRAM_DEFAULT_CHAT_ID).'
        : 'Falta TELEGRAM_DEFAULT_CHAT_ID para envio sin destino manual.',
    ],
  };
}

async function sendTelegramApi({ token, chatId, text }) {
  if (!token) {
    return {
      ok: false,
      status: 'failed',
      reason: 'missing_token',
      message: 'TELEGRAM_BOT_TOKEN no esta configurado.',
    };
  }

  if (typeof fetch !== 'function') {
    return {
      ok: false,
      status: 'failed',
      reason: 'fetch_unavailable',
      message: 'El runtime actual no soporta fetch para Telegram API.',
    };
  }

  try {
    const endpoint = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json?.ok === false) {
      return {
        ok: false,
        status: 'failed',
        reason: 'telegram_api_error',
        httpStatus: response.status,
        message: json?.description || `Telegram API respondio con ${response.status}.`,
      };
    }
    return {
      ok: true,
      status: 'sent',
      provider: 'telegram',
      httpStatus: response.status,
      telegramMessageId: Number(json?.result?.message_id || 0) || null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 'failed',
      reason: 'telegram_network_error',
      message: error?.message || 'No se pudo conectar con Telegram API.',
    };
  }
}

async function sendTelegramNotification(options = {}) {
  const settings = options.settings && typeof options.settings === 'object'
    ? (options.settings.telegram && typeof options.settings.telegram === 'object' ? options.settings.telegram : options.settings)
    : {};
  const config = resolveTelegramConfig(settings);
  const chatId = normalizeTelegramChatId(options.to || options.chatId || config.defaultChatId);
  const text = cleanString(options.message, 3500);
  const eventType = cleanString(options.eventType || 'system', 120).toLowerCase() || 'system';

  if (!chatId) {
    return {
      ok: true,
      status: 'skipped',
      reason: 'missing_recipient',
      channel: 'telegram',
      message: 'No hay chat_id de Telegram configurado.',
    };
  }

  if (!text) {
    return {
      ok: true,
      status: 'skipped',
      reason: 'empty_message',
      channel: 'telegram',
      message: 'No hay contenido para enviar.',
    };
  }

  if (config.transport === 'disabled') {
    return {
      ok: true,
      status: 'skipped',
      reason: 'transport_disabled',
      channel: 'telegram',
      to: maskChatId(chatId),
      eventType,
      message: 'Canal Telegram deshabilitado (TELEGRAM_TRANSPORT=disabled).',
    };
  }

  if (config.transport === 'noop') {
    return {
      ok: true,
      status: 'simulated',
      reason: 'noop_transport',
      channel: 'telegram',
      to: maskChatId(chatId),
      eventType,
      preview: text.slice(0, 200),
      message: 'Simulacion realizada (TELEGRAM_TRANSPORT=noop).',
    };
  }

  const sendResult = await sendTelegramApi({
    token: config.token,
    chatId,
    text,
  });
  if (!sendResult.ok) return sendResult;
  return {
    ...sendResult,
    channel: 'telegram',
    to: maskChatId(chatId),
    eventType,
  };
}

module.exports = {
  normalizeTelegramChatId,
  getTelegramChannelStatus,
  sendTelegramNotification,
};
