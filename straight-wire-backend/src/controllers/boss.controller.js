'use strict';

// Boss controllers (frontend contract).
//
// Mounted under /boss (verifyFirebaseToken + requireRole('boss') are applied in src/index.js).

const { z } = require('zod');

const { STATUS, listJobsForBoss, assignJobToEmployee } = require('../services/jobs.service');
const { getUserProfile } = require('../services/users.service');
const { assignUserRole } = require('../services/roles.service');
const {
  listEmployeeApplications,
  getEmployeeApplication,
  setEmployeeApplicationStatus,
} = require('../services/employeeRequests.service');
const {
  listPhotoChangeRequests,
  approvePhotoChange,
  rejectPhotoChange,
} = require('../services/employeePhotoChange.service');
const { getCompanyConfig, updateCompanyConfig } = require('../services/companyConfig.service');
const {
  getNotificationSettings,
  updateNotificationSettings,
  sanitizeNotificationSettingsForBoss,
} = require('../services/notificationSettings.service');
const { getWhatsAppChannelStatus, sendWhatsAppNotification } = require('../services/whatsappNotifications.service');
const { getTelegramChannelStatus, sendTelegramNotification } = require('../services/telegramNotifications.service');

function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function serializeTimestamps(obj, fields) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  for (const field of fields) {
    if (field in out) out[field] = toIso(out[field]);
  }
  return out;
}

function serializeJob(job) {
  return serializeTimestamps(job, [
    'createdAt',
    'updatedAt',
    'assignedAt',
    'unassignedAt',
    'startedAt',
    'completedAt',
    'cancelledAt',
    'claimedAt',
  ]);
}

function serializeEmployeeRequest(req) {
  return serializeTimestamps(req, ['createdAt', 'updatedAt', 'decidedAt']);
}

function serializePhotoChange(req) {
  return serializeTimestamps(req, ['createdAt', 'updatedAt', 'requestedAt', 'approvedAt', 'rejectedAt', 'completedAt']);
}

function sendError(res, status, error, message) {
  return res.status(status).json({ error, message });
}

function handleError(res, err) {
  const status = err && typeof err.status === 'number' ? err.status : 500;
  const error = err && typeof err.code === 'string' ? err.code : 'internal_error';

  // Avoid leaking internals.
  const message = status >= 500 ? 'Internal Server Error' : err.message || 'Request failed.';

  // Frontend contract doesn't define 409; normalize to 400.
  const normalizedStatus = status === 409 ? 400 : status;

  return sendError(res, normalizedStatus, String(error).toLowerCase(), message);
}

const assignSchema = z.object({
  employeeId: z.string().trim().min(1),
});

const companyBackgroundEntrySchema = z.object({
  url: z.string().trim().min(1).max(2000).optional(),
  fit: z.enum(['cover', 'contain']).optional(),
}).refine((value) => Object.keys(value || {}).length > 0, {
  message: 'Background config entry is required.',
});

const serviceCategorySchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9_-]+$/i).min(1).max(40),
  label: z.string().trim().min(1).max(80),
  icon: z.string().trim().max(16).optional().or(z.literal('')),
});

const portalCardSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().min(1).max(240).optional(),
  ctaLabel: z.string().trim().min(1).max(60).optional(),
  icon: z.string().trim().max(16).optional().or(z.literal('')),
  imageUrl: z.string().trim().max(2000).optional().or(z.literal('')),
}).refine((value) => Object.keys(value || {}).length > 0, {
  message: 'Portal card config entry is required.',
});

const photoMimeTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp']);

const companyConfigSchema = z.object({
  displayName: z.string().trim().min(1).max(160).optional(),
  legalName: z.string().trim().min(1).max(200).optional(),
  tagline: z.string().trim().min(1).max(200).optional(),
  logoUrl: z.string().trim().min(1).max(2000).optional(),
  backgroundImageUrl: z.string().trim().min(1).max(2000).optional(),
  backgrounds: z.record(
    z.string().trim().regex(/^[a-z0-9_-]+$/i).max(60),
    companyBackgroundEntrySchema,
  ).optional(),
  phone: z.string().trim().min(1).max(80).optional(),
  whatsappNumber: z.string().trim().regex(/^\+?[0-9]{8,15}$/).max(40).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  locale: z.string().trim().min(2).max(20).optional(),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).optional(),
  photoPolicy: z.object({
    maxUploadBytes: z.number().int().positive().max(10 * 1024 * 1024).optional(),
    maxImageDimension: z.number().int().positive().max(8000).optional(),
    compressionTargetBytes: z.number().int().positive().max(10 * 1024 * 1024).optional(),
    allowedMimeTypes: z.array(photoMimeTypeSchema).min(1).max(3).optional(),
  }).refine((value) => Object.keys(value || {}).length > 0, {
    message: 'Photo policy config entry is required.',
  }).optional(),
  email: z.string().trim().min(1).max(200).optional(),
  address: z.string().trim().min(1).max(400).optional(),
  ein: z.string().trim().min(1).max(80).optional(),
  serviceCategories: z.array(serviceCategorySchema).max(20).optional(),
  portalCards: z.object({
    client: portalCardSchema.optional(),
    employee: portalCardSchema.optional(),
    boss: portalCardSchema.optional(),
  }).optional(),
  estimate: z.object({
    title: z.string().trim().min(1).max(120).optional(),
    defaultNotes: z.string().trim().min(1).max(6000).optional(),
  }).optional(),
}).refine((value) => Object.keys(value || {}).length > 0, {
  message: 'Company config payload is required.',
});

const whatsappTestSchema = z.object({
  to: z.string().trim().max(40).optional(),
  message: z.string().trim().min(1).max(1200).optional(),
});

const telegramTestSchema = z.object({
  to: z.string().trim().max(120).optional(),
  message: z.string().trim().min(1).max(3500).optional(),
});

const notificationSettingsSchema = z.object({
  whatsapp: z.object({
    alertNumber: z.string().trim().regex(/^\+?[0-9]{8,15}$/).max(40).optional(),
    transport: z.enum(['noop', 'webhook', 'twilio']).optional(),
    webhookUrl: z.string().trim().url().max(2000).optional().or(z.literal('')),
    webhookToken: z.string().trim().max(300).optional(),
    twilioAccountSid: z.string().trim().max(120).optional(),
    twilioAuthToken: z.string().trim().max(240).optional(),
    twilioWhatsAppFrom: z.string().trim().max(80).optional(),
    twilioMessagingServiceSid: z.string().trim().max(80).optional(),
    twilioStatusCallbackUrl: z.string().trim().url().max(2000).optional().or(z.literal('')),
  }).optional(),
  telegram: z.object({
    transport: z.enum(['disabled', 'noop', 'api']).optional(),
    botToken: z.string().trim().max(400).optional(),
    defaultChatId: z.string().trim().max(120).optional(),
  }).optional(),
}).refine((value) => Object.keys(value || {}).length > 0, {
  message: 'Notification settings payload is required.',
});

async function getRequests(req, res) {
  const statusRaw = req.query && typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const status = statusRaw || STATUS.OPEN;

  if (!Object.values(STATUS).includes(status)) {
    return sendError(res, 400, 'invalid_payload', 'Invalid status filter.');
  }

  const limit = req.query && req.query.limit;
  const employeeId = req.query && typeof req.query.employeeId === 'string' ? req.query.employeeId.trim() : null;
  const clientId = req.query && typeof req.query.clientId === 'string' ? req.query.clientId.trim() : null;

  try {
    const jobs = await listJobsForBoss({ status, employeeId, clientId, limit });
    return res.status(200).json(jobs.map(serializeJob));
  } catch (err) {
    return handleError(res, err);
  }
}

async function assignRequest(req, res) {
  const jobId = req.params && req.params.id;
  if (!jobId) return sendError(res, 400, 'invalid_payload', 'Request id is required.');

  let input;
  try {
    input = assignSchema.parse(req.body || {});
  } catch (err) {
    return sendError(res, 400, 'invalid_payload', 'employeeId is required.');
  }

  try {
    const employeeProfile = await getUserProfile(input.employeeId, {
      notFoundCode: 'not_found',
      notFoundMessage: 'Employee not found.',
    });

    if (employeeProfile.role !== 'employee') {
      return sendError(res, 400, 'invalid_payload', 'Target user is not an employee.');
    }

    const updated = await assignJobToEmployee(jobId, input.employeeId);
    return res.status(200).json(serializeJob(updated));
  } catch (err) {
    return handleError(res, err);
  }
}

async function getEmployeeRequests(req, res) {
  const limit = req.query && req.query.limit;

  try {
    const requests = await listEmployeeApplications({ status: 'pending', limit });
    return res.status(200).json(requests.map(serializeEmployeeRequest));
  } catch (err) {
    return handleError(res, err);
  }
}

async function getPhotoChangeRequests(req, res) {
  const limit = req.query && req.query.limit;
  const statusRaw = req.query && typeof req.query.status === 'string' ? req.query.status.trim() : 'pending';

  try {
    const requests = await listPhotoChangeRequests({ status: statusRaw || 'pending', limit });
    return res.status(200).json(requests.map(serializePhotoChange));
  } catch (err) {
    return handleError(res, err);
  }
}

async function approvePhotoChangeRequest(req, res) {
  const id = req.params && req.params.id;
  if (!id) return sendError(res, 400, 'invalid_payload', 'Request id is required.');
  const bossUid = req.user && req.user.uid ? req.user.uid : null;

  try {
    const updated = await approvePhotoChange(id, bossUid);
    return res.status(200).json(serializePhotoChange(updated));
  } catch (err) {
    return handleError(res, err);
  }
}

async function rejectPhotoChangeRequest(req, res) {
  const id = req.params && req.params.id;
  if (!id) return sendError(res, 400, 'invalid_payload', 'Request id is required.');
  const bossUid = req.user && req.user.uid ? req.user.uid : null;

  try {
    const updated = await rejectPhotoChange(id, bossUid);
    return res.status(200).json(serializePhotoChange(updated));
  } catch (err) {
    return handleError(res, err);
  }
}

async function approveEmployeeRequest(req, res) {
  const id = req.params && req.params.id;
  if (!id) return sendError(res, 400, 'invalid_payload', 'Request id is required.');

  const bossUid = req.user && req.user.uid ? req.user.uid : null;

  try {
    const application = await getEmployeeApplication(id);
    if (application.status !== 'pending') {
      return sendError(res, 400, 'invalid_state', 'Employee request is not pending.');
    }

    await assignUserRole(application.uid, 'employee');
    const updated = await setEmployeeApplicationStatus(id, 'approved', { decidedBy: bossUid });
    return res.status(200).json(serializeEmployeeRequest(updated));
  } catch (err) {
    return handleError(res, err);
  }
}

async function rejectEmployeeRequest(req, res) {
  const id = req.params && req.params.id;
  if (!id) return sendError(res, 400, 'invalid_payload', 'Request id is required.');

  const bossUid = req.user && req.user.uid ? req.user.uid : null;

  try {
    const application = await getEmployeeApplication(id);
    if (application.status !== 'pending') {
      return sendError(res, 400, 'invalid_state', 'Employee request is not pending.');
    }

    const updated = await setEmployeeApplicationStatus(id, 'rejected', { decidedBy: bossUid });
    return res.status(200).json(serializeEmployeeRequest(updated));
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * GET /api/boss/me
 * Returns the current authenticated boss's info.
 * Used by role-gateway.js to determine if user has boss role.
 */
async function getMe(req, res) {
  if (!req.user || !req.user.uid) {
    return res.status(401).json({ ok: false, error: 'unauthenticated', message: 'No token provided.' });
  }

  // Role is already verified by requireRole('boss') in index.js
  return res.status(200).json({
    ok: true,
    data: {
      id: req.user.uid,
      email: req.user.email || null,
      role: 'boss',
    },
  });
}

async function getBossCompanyConfig(req, res) {
  try {
    const config = await getCompanyConfig();
    return res.status(200).json({ ok: true, data: config });
  } catch (err) {
    return handleError(res, err);
  }
}

async function updateBossCompanyConfig(req, res) {
  let input;
  try {
    input = companyConfigSchema.parse(req.body || {});
  } catch (_) {
    return sendError(res, 400, 'invalid_payload', 'Invalid company config payload.');
  }

  try {
    const config = await updateCompanyConfig(input, {
      uid: req.user && req.user.uid ? req.user.uid : null,
    });
    return res.status(200).json({ ok: true, data: config });
  } catch (err) {
    return handleError(res, err);
  }
}

async function getBossNotificationSettings(req, res) {
  try {
    const [settings, companyConfig] = await Promise.all([
      getNotificationSettings(),
      getCompanyConfig(),
    ]);
    const sanitized = sanitizeNotificationSettingsForBoss(settings);
    if (!sanitized.whatsapp.alertNumber && companyConfig?.whatsappNumber) {
      sanitized.whatsapp.alertNumber = companyConfig.whatsappNumber;
    }
    return res.status(200).json({
      ok: true,
      data: sanitized,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

async function updateBossNotificationSettings(req, res) {
  let input;
  try {
    input = notificationSettingsSchema.parse(req.body || {});
  } catch (_) {
    return sendError(res, 400, 'invalid_payload', 'Invalid notification settings payload.');
  }

  try {
    const settings = await updateNotificationSettings(input, {
      uid: req.user && req.user.uid ? req.user.uid : null,
    });
    const companyConfig = await getCompanyConfig();
    const sanitized = sanitizeNotificationSettingsForBoss(settings);
    if (!sanitized.whatsapp.alertNumber && companyConfig?.whatsappNumber) {
      sanitized.whatsapp.alertNumber = companyConfig.whatsappNumber;
    }
    return res.status(200).json({
      ok: true,
      data: sanitized,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

async function getBossNotificationChannels(req, res) {
  try {
    const [config, notificationSettings] = await Promise.all([
      getCompanyConfig(),
      getNotificationSettings(),
    ]);
    const whatsapp = getWhatsAppChannelStatus(config, notificationSettings.whatsapp);
    const telegram = getTelegramChannelStatus(notificationSettings.telegram);
    return res.status(200).json({
      ok: true,
      data: { whatsapp, telegram },
    });
  } catch (err) {
    return handleError(res, err);
  }
}

async function sendBossWhatsappTest(req, res) {
  let input;
  try {
    input = whatsappTestSchema.parse(req.body || {});
  } catch (_) {
    return sendError(res, 400, 'invalid_payload', 'Invalid WhatsApp test payload.');
  }

  try {
    const [config, notificationSettings] = await Promise.all([
      getCompanyConfig(),
      getNotificationSettings(),
    ]);
    const result = await sendWhatsAppNotification({
      companyConfig: config,
      settings: notificationSettings.whatsapp,
      to: input.to,
      message: input.message || `Prueba de WhatsApp del panel jefe (${new Date().toISOString()}).`,
      eventType: 'boss_test',
      metadata: {
        source: 'boss-panel',
        bossUid: req.user && req.user.uid ? req.user.uid : null,
      },
    });

    const ok = Boolean(result && result.ok);
    const statusCode = ok ? 200 : 502;
    return res.status(statusCode).json({
      ok,
      data: result,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

async function sendBossTelegramTest(req, res) {
  let input;
  try {
    input = telegramTestSchema.parse(req.body || {});
  } catch (_) {
    return sendError(res, 400, 'invalid_payload', 'Invalid Telegram test payload.');
  }

  try {
    const notificationSettings = await getNotificationSettings();
    const result = await sendTelegramNotification({
      settings: notificationSettings.telegram,
      to: input.to,
      message: input.message || `Prueba de Telegram del panel jefe (${new Date().toISOString()}).`,
      eventType: 'boss_test',
    });

    const ok = Boolean(result && result.ok);
    const statusCode = ok ? 200 : 502;
    return res.status(statusCode).json({
      ok,
      data: result,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = {
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
};
