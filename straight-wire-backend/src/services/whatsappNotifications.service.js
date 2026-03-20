'use strict';

const { mergeCompanyConfig } = require('./companyConfig.service');

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

function normalizeWhatsAppAddress(value) {
  const raw = cleanString(value, 80);
  if (!raw) return '';
  const withoutPrefix = raw.toLowerCase().startsWith('whatsapp:')
    ? raw.slice('whatsapp:'.length)
    : raw;
  const e164 = normalizeE164(withoutPrefix);
  return e164 ? `whatsapp:${e164}` : '';
}

function maskPhone(value) {
  const normalized = normalizeE164(value);
  if (!normalized) return '';
  const digits = normalized.replace(/[^\d]/g, '');
  if (digits.length <= 4) return `+${digits}`;
  const tail = digits.slice(-4);
  return `+${'*'.repeat(Math.max(0, digits.length - 4))}${tail}`;
}

function buildMissingList(parts = []) {
  return parts.filter(Boolean);
}

function isInternalWebhookUrl(value) {
  const raw = cleanString(value, 2000).toLowerCase();
  if (!raw) return false;
  return raw.includes('/api/hooks/whatsapp/send');
}

function resolveTransportConfig(settingsInput = {}) {
  const settings = settingsInput && typeof settingsInput === 'object'
    ? (settingsInput.whatsapp && typeof settingsInput.whatsapp === 'object' ? settingsInput.whatsapp : settingsInput)
    : {};

  const transportRaw = cleanString(settings.transport || process.env.WHATSAPP_TRANSPORT || 'noop', 24).toLowerCase();
  const transport = ['noop', 'webhook', 'twilio'].includes(transportRaw) ? transportRaw : 'noop';

  const webhookUrl = cleanString(settings.webhookUrl || process.env.WHATSAPP_WEBHOOK_URL, 2000);
  const webhookToken = cleanString(settings.webhookToken || process.env.WHATSAPP_WEBHOOK_TOKEN, 300);

  const twilioAccountSid = cleanString(settings.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID, 120);
  const twilioAuthToken = cleanString(settings.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN, 240);
  const twilioFrom = normalizeWhatsAppAddress(settings.twilioWhatsAppFrom || process.env.TWILIO_WHATSAPP_FROM);
  const twilioMessagingServiceSid = cleanString(settings.twilioMessagingServiceSid || process.env.TWILIO_MESSAGING_SERVICE_SID, 80);
  const twilioStatusCallbackUrl = cleanString(settings.twilioStatusCallbackUrl || process.env.TWILIO_WHATSAPP_STATUS_CALLBACK_URL, 2000);
  const internalWebhook = isInternalWebhookUrl(webhookUrl);

  const missingForTwilio = buildMissingList([
    twilioAccountSid ? '' : 'TWILIO_ACCOUNT_SID',
    twilioAuthToken ? '' : 'TWILIO_AUTH_TOKEN',
    twilioFrom || twilioMessagingServiceSid ? '' : 'TWILIO_WHATSAPP_FROM/TWILIO_MESSAGING_SERVICE_SID',
  ]);

  const configured = transport === 'noop'
    ? true
    : (transport === 'webhook'
      ? Boolean(webhookUrl) && (!internalWebhook || Boolean(webhookToken))
      : missingForTwilio.length === 0);

  return {
    transport,
    webhookUrl,
    webhookToken,
    internalWebhook,
    twilioAccountSid,
    twilioAuthToken,
    twilioFrom,
    twilioMessagingServiceSid,
    twilioStatusCallbackUrl,
    twilioConfigMissing: missingForTwilio,
    configured,
  };
}

function getTransportNotes(transport) {
  if (transport.transport === 'noop') {
    return ['WHATSAPP_TRANSPORT=noop (simulacion sin envio real).'];
  }
  if (transport.transport === 'webhook') {
    const webhookNote = transport.internalWebhook
      ? (transport.webhookToken
        ? 'WHATSAPP_TRANSPORT=webhook (webhook interno protegido con Bearer token).'
        : 'Falta WHATSAPP_WEBHOOK_TOKEN para usar el webhook interno.')
      : (transport.configured
        ? 'WHATSAPP_TRANSPORT=webhook (envio real via webhook).'
        : 'Falta WHATSAPP_WEBHOOK_URL para envio real via webhook.');

    return [
      webhookNote,
      transport.internalWebhook
        ? (transport.twilioConfigMissing.length === 0
          ? 'El webhook interno puede reenviar por Twilio con la configuracion guardada.'
          : 'Si quieres envio real desde el webhook interno, completa tambien las credenciales Twilio.')
        : 'Tu webhook externo debe encargarse de enviar el mensaje al proveedor final.',
    ];
  }

  const base = transport.configured
    ? 'WHATSAPP_TRANSPORT=twilio (envio real via Twilio WhatsApp API).'
    : `Falta configurar ${transport.twilioConfigMissing.join(', ')} para Twilio WhatsApp.`;
  return [
    base,
    'Para automatizacion fuera de la ventana de 24h de WhatsApp, el proveedor puede requerir plantilla aprobada.',
  ];
}

function getWhatsAppChannelStatus(companyConfigInput, settingsInput = {}) {
  const companyConfig = mergeCompanyConfig(companyConfigInput || {});
  const settings = settingsInput && typeof settingsInput === 'object'
    ? (settingsInput.whatsapp && typeof settingsInput.whatsapp === 'object' ? settingsInput.whatsapp : settingsInput)
    : {};
  const transport = resolveTransportConfig(settings);
  const configuredRecipient = normalizeE164(settings.alertNumber || companyConfig.whatsappNumber);
  const internalWebhookSimulated = transport.transport === 'webhook'
    && transport.internalWebhook
    && transport.twilioConfigMissing.length > 0;
  const simulated = transport.transport === 'noop' || internalWebhookSimulated;
  const deliveryReady = transport.transport === 'webhook'
    ? (transport.internalWebhook ? transport.configured && !internalWebhookSimulated : transport.configured)
    : (!simulated && transport.configured);
  const ready = Boolean(configuredRecipient) && deliveryReady;

  return {
    channel: 'whatsapp',
    provider: transport.transport === 'twilio' ? 'twilio' : transport.transport,
    transport: transport.transport,
    transportConfigured: transport.configured,
    hasWebhookToken: Boolean(transport.webhookToken),
    internalWebhook: Boolean(transport.internalWebhook),
    simulated,
    deliveryReady,
    hasConfiguredRecipient: Boolean(configuredRecipient),
    configuredRecipientPreview: configuredRecipient ? maskPhone(configuredRecipient) : '',
    ready,
    mode: simulated ? 'simulado' : 'activo',
    notes: [
      ...getTransportNotes(transport),
      configuredRecipient
        ? 'Numero de destino configurado en Panel Jefe.'
        : 'Falta numero WhatsApp de alertas en configuracion de empresa.',
    ],
  };
}

async function sendViaWebhook(payload, transport) {
  if (!transport.webhookUrl) {
    return {
      ok: false,
      status: 'failed',
      reason: 'missing_webhook_url',
      message: 'WHATSAPP_WEBHOOK_URL no esta configurado.',
    };
  }

  if (typeof fetch !== 'function') {
    return {
      ok: false,
      status: 'failed',
      reason: 'fetch_unavailable',
      message: 'El runtime actual no soporta fetch para webhook.',
    };
  }

  try {
    const response = await fetch(transport.webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(transport.webhookToken ? { authorization: `Bearer ${transport.webhookToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const bodyText = await response.text().catch(() => '');
    if (!response.ok) {
      return {
        ok: false,
        status: 'failed',
        reason: 'webhook_http_error',
        httpStatus: response.status,
        message: bodyText || `Webhook respondio con ${response.status}.`,
      };
    }

    return {
      ok: true,
      status: 'sent',
      provider: 'webhook',
      httpStatus: response.status,
      responsePreview: bodyText.slice(0, 500),
    };
  } catch (error) {
    return {
      ok: false,
      status: 'failed',
      reason: 'webhook_network_error',
      message: error?.message || 'No se pudo conectar al webhook de WhatsApp.',
    };
  }
}

async function sendViaTwilio(payload, transport) {
  if (!transport.configured) {
    return {
      ok: false,
      status: 'failed',
      reason: 'missing_twilio_config',
      message: `Configuracion incompleta de Twilio: ${transport.twilioConfigMissing.join(', ')}.`,
    };
  }

  if (typeof fetch !== 'function') {
    return {
      ok: false,
      status: 'failed',
      reason: 'fetch_unavailable',
      message: 'El runtime actual no soporta fetch para Twilio.',
    };
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(transport.twilioAccountSid)}/Messages.json`;
  const params = new URLSearchParams();
  params.set('To', `whatsapp:${payload.to}`);
  if (transport.twilioMessagingServiceSid) {
    params.set('MessagingServiceSid', transport.twilioMessagingServiceSid);
  } else if (transport.twilioFrom) {
    params.set('From', transport.twilioFrom);
  }
  params.set('Body', payload.text);
  if (transport.twilioStatusCallbackUrl) {
    params.set('StatusCallback', transport.twilioStatusCallbackUrl);
  }

  const authHeader = Buffer.from(`${transport.twilioAccountSid}:${transport.twilioAuthToken}`).toString('base64');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Basic ${authHeader}`,
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: params.toString(),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        status: 'failed',
        reason: 'twilio_http_error',
        provider: 'twilio',
        httpStatus: response.status,
        twilioCode: Number(json?.code || 0) || null,
        message: json?.message || `Twilio respondio con ${response.status}.`,
      };
    }

    return {
      ok: true,
      status: 'sent',
      provider: 'twilio',
      httpStatus: response.status,
      providerMessageId: cleanString(json?.sid, 80) || null,
      providerStatus: cleanString(json?.status, 80) || null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 'failed',
      reason: 'twilio_network_error',
      provider: 'twilio',
      message: error?.message || 'No se pudo conectar con Twilio WhatsApp API.',
    };
  }
}

async function sendWhatsAppNotification(options = {}) {
  const companyConfig = mergeCompanyConfig(options.companyConfig || {});
  const settings = options.settings && typeof options.settings === 'object'
    ? (options.settings.whatsapp && typeof options.settings.whatsapp === 'object' ? options.settings.whatsapp : options.settings)
    : {};
  const toRaw = cleanString(options.to || settings.alertNumber || companyConfig.whatsappNumber, 40);
  const to = normalizeE164(toRaw);
  const text = cleanString(options.message, 1200);
  const eventType = cleanString(options.eventType || 'system', 120).toLowerCase() || 'system';
  const transport = resolveTransportConfig(settings);

  if (!to) {
    return {
      ok: true,
      status: 'skipped',
      reason: 'missing_recipient',
      channel: 'whatsapp',
      message: 'No hay numero configurado para WhatsApp.',
    };
  }

  if (!text) {
    return {
      ok: true,
      status: 'skipped',
      reason: 'empty_message',
      channel: 'whatsapp',
      message: 'No hay contenido para enviar.',
    };
  }

  if (transport.transport === 'noop') {
    return {
      ok: true,
      status: 'simulated',
      reason: 'noop_transport',
      channel: 'whatsapp',
      to: maskPhone(to),
      eventType,
      preview: text.slice(0, 180),
      message: 'Simulacion realizada (WHATSAPP_TRANSPORT=noop).',
    };
  }

  const payload = {
    channel: 'whatsapp',
    eventType,
    to,
    text,
    metadata: options.metadata && typeof options.metadata === 'object' ? options.metadata : {},
    company: {
      displayName: companyConfig.displayName || '',
      legalName: companyConfig.legalName || '',
      whatsappNumber: companyConfig.whatsappNumber || '',
    },
    sentAt: new Date().toISOString(),
  };

  const sendResult = transport.transport === 'twilio'
    ? await sendViaTwilio(payload, transport)
    : await sendViaWebhook(payload, transport);

  if (!sendResult.ok) return sendResult;
  return {
    ...sendResult,
    channel: 'whatsapp',
    to: maskPhone(to),
    eventType,
  };
}

module.exports = {
  normalizeE164,
  normalizeWhatsAppAddress,
  resolveWhatsAppTransportConfig: resolveTransportConfig,
  sendWhatsAppViaTwilio: sendViaTwilio,
  getWhatsAppChannelStatus,
  sendWhatsAppNotification,
};
