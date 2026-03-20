'use strict';

const MOBILE_ALLOWED_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const DEFAULT_MOBILE_PHOTO_POLICY = Object.freeze({
  maxUploadBytes: 1024 * 1024,
  maxImageDimension: 1600,
  compressionTargetBytes: 1024 * 1024,
  allowedMimeTypes: [...MOBILE_ALLOWED_MIME_TYPES],
});

const DEFAULT_MOBILE_FEATURE_FLAGS = Object.freeze({
  employeeHome: true,
  bossHome: true,
  emergencyFlow: true,
  paymentReview: true,
  builderMobile: true,
  pushNotifications: true,
});

const DEFAULT_MOBILE_COMPANY_CONFIG = Object.freeze({
  companyName: 'Straight Wire Electric',
  timezone: 'America/Guatemala',
  locale: 'es-GT',
  currency: 'GTQ',
  logoUrl: 'assets/images/logo.webp',
  supportPhone: '3236142546',
  whatsappNumber: null,
  photoPolicy: DEFAULT_MOBILE_PHOTO_POLICY,
});

const REQUEST_TERMINAL_STATUSES = new Set([
  'COMPLETADO',
  'CANCELADO',
]);

const CLIENT_ACTIONABLE_REQUEST_STATUSES = new Set([
  'NEGOCIANDO',
  'ESPERANDO_CIERRE_CLIENTE',
  'ESPERANDO_COMPROBANTE_PAGO',
]);

const EMPLOYEE_ASSIGNED_REQUEST_STATUSES = new Set([
  'ASIGNADO',
]);

const EMPLOYEE_IN_PROGRESS_REQUEST_STATUSES = new Set([
  'NEGOCIANDO',
  'EN_PROCESO',
  'ESPERANDO_CIERRE_CLIENTE',
  'ESPERANDO_COMPROBANTE_PAGO',
  'PAGO_PENDIENTE_REVISION',
]);

const EMERGENCY_ACTIVE_STATUSES = new Set([
  'accepted',
  'awaiting_client_close',
  'awaiting_payment_proof',
  'payment_pending_review',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value, maxLength = 5000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function cleanNullableString(value, maxLength = 5000) {
  const normalized = cleanString(value, maxLength);
  return normalized || null;
}

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizeNullableNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeNullableInteger(value) {
  const parsed = normalizeNullableNumber(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeDateTime(value) {
  if (value == null || value === '') return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : trimmed;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

function normalizeDateTimeMs(value, fallbackValue = null) {
  const parsed = normalizeNullableInteger(value);
  if (parsed != null) return parsed;

  const normalizedFallback = normalizeDateTime(fallbackValue);
  if (!normalizedFallback) return null;

  const ms = Date.parse(normalizedFallback);
  return Number.isFinite(ms) ? ms : null;
}

function normalizeTimezone(value, fallback = DEFAULT_MOBILE_COMPANY_CONFIG.timezone) {
  return cleanString(value, 80) || fallback;
}

function normalizeLocale(value, fallback = DEFAULT_MOBILE_COMPANY_CONFIG.locale) {
  return cleanString(value, 20).replace(/_/g, '-') || fallback;
}

function normalizeCurrency(value, fallback = DEFAULT_MOBILE_COMPANY_CONFIG.currency) {
  const normalized = cleanString(value, 3).toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : fallback;
}

function normalizeAllowedMimeTypes(value, fallback = DEFAULT_MOBILE_PHOTO_POLICY.allowedMimeTypes) {
  const source = Array.isArray(value) ? value : fallback;
  const unique = [];

  source.forEach((entry) => {
    const mimeType = cleanString(entry, 40).toLowerCase();
    if (!MOBILE_ALLOWED_MIME_TYPES.includes(mimeType)) return;
    if (unique.includes(mimeType)) return;
    unique.push(mimeType);
  });

  return unique.length ? unique : [...DEFAULT_MOBILE_PHOTO_POLICY.allowedMimeTypes];
}

function normalizeMobilePhotoPolicy(input = {}, fallback = DEFAULT_MOBILE_PHOTO_POLICY) {
  const source = isRecord(input) ? input : {};
  const base = isRecord(fallback) ? fallback : DEFAULT_MOBILE_PHOTO_POLICY;

  return {
    maxUploadBytes: normalizePositiveInteger(
      source.maxUploadBytes,
      normalizePositiveInteger(base.maxUploadBytes, DEFAULT_MOBILE_PHOTO_POLICY.maxUploadBytes),
    ),
    maxImageDimension: normalizePositiveInteger(
      source.maxImageDimension,
      normalizePositiveInteger(base.maxImageDimension, DEFAULT_MOBILE_PHOTO_POLICY.maxImageDimension),
    ),
    compressionTargetBytes: normalizePositiveInteger(
      source.compressionTargetBytes,
      normalizePositiveInteger(base.compressionTargetBytes, DEFAULT_MOBILE_PHOTO_POLICY.compressionTargetBytes),
    ),
    allowedMimeTypes: normalizeAllowedMimeTypes(
      source.allowedMimeTypes,
      normalizeAllowedMimeTypes(base.allowedMimeTypes, DEFAULT_MOBILE_PHOTO_POLICY.allowedMimeTypes),
    ),
  };
}

function buildMobileFeatureFlags(input = {}) {
  const source = isRecord(input) ? input : {};

  return {
    employeeHome: normalizeBoolean(source.employeeHome, DEFAULT_MOBILE_FEATURE_FLAGS.employeeHome),
    bossHome: normalizeBoolean(source.bossHome, DEFAULT_MOBILE_FEATURE_FLAGS.bossHome),
    emergencyFlow: normalizeBoolean(source.emergencyFlow, DEFAULT_MOBILE_FEATURE_FLAGS.emergencyFlow),
    paymentReview: normalizeBoolean(source.paymentReview, DEFAULT_MOBILE_FEATURE_FLAGS.paymentReview),
    builderMobile: normalizeBoolean(source.builderMobile, DEFAULT_MOBILE_FEATURE_FLAGS.builderMobile),
    pushNotifications: normalizeBoolean(source.pushNotifications, DEFAULT_MOBILE_FEATURE_FLAGS.pushNotifications),
  };
}

function buildMobileCompanyConfig(input = {}) {
  const source = isRecord(input) ? input : {};
  const defaults = DEFAULT_MOBILE_COMPANY_CONFIG;

  return {
    companyName: cleanString(source.companyName || source.displayName, 160) || defaults.companyName,
    timezone: normalizeTimezone(source.timezone, defaults.timezone),
    locale: normalizeLocale(source.locale, defaults.locale),
    currency: normalizeCurrency(source.currency, defaults.currency),
    logoUrl: cleanNullableString(source.logoUrl, 2000) || defaults.logoUrl,
    supportPhone: cleanNullableString(source.supportPhone || source.phone, 80) || defaults.supportPhone,
    whatsappNumber: cleanNullableString(source.whatsappNumber, 40),
    photoPolicy: normalizeMobilePhotoPolicy(source.photoPolicy, defaults.photoPolicy),
  };
}

function buildMobileBootstrapResponse(input = {}) {
  const source = isRecord(input) ? input : {};
  const user = isRecord(source.user) ? source.user : {};

  return {
    user: {
      uid: cleanString(user.uid, 128),
      email: cleanNullableString(user.email, 320),
      displayName: cleanNullableString(user.displayName || user.name, 200),
    },
    role: cleanString(source.role, 20),
    featureFlags: buildMobileFeatureFlags(source.featureFlags),
    companyConfig: buildMobileCompanyConfig(source.companyConfig),
  };
}

function normalizeMarketplaceRequestStatus(value) {
  return cleanString(value, 80).toUpperCase();
}

function normalizeEmergencyStatus(value) {
  return cleanString(value, 80).toLowerCase();
}

function normalizeDispatchMode(value) {
  const normalized = cleanString(value, 40).toLowerCase();
  return normalized || null;
}

function normalizeMarketplaceRequest(input = {}) {
  if (!isRecord(input)) return null;
  const source = input;

  return {
    id: cleanString(source.id, 128),
    status: normalizeMarketplaceRequestStatus(source.status),
    category: cleanNullableString(source.category, 120),
    description: cleanNullableString(source.description, 5000),
    address: cleanNullableString(source.address, 1000),
    photoUrl: cleanNullableString(source.photoUrl, 2000),
    proposal: source.proposal == null ? null : source.proposal,
    clientId: cleanNullableString(source.clientId, 128),
    clientEmail: cleanNullableString(source.clientEmail, 320),
    clientNickname: cleanNullableString(source.clientNickname, 200),
    assignedEmployeeId: cleanNullableString(source.assignedEmployeeId, 128),
    employeeName: cleanNullableString(source.employeeName || source.assignedEmployeeName, 200),
    employeeEmail: cleanNullableString(source.employeeEmail || source.assignedEmployeeEmail, 320),
    finalAmount: normalizeNullableNumber(source.finalAmount),
    clientRating: normalizeNullableNumber(source.clientRating),
    paymentProofUrl: cleanNullableString(source.paymentProofUrl, 2000),
    paymentProofAt: normalizeDateTime(source.paymentProofAt),
    paymentRejectionReason: cleanNullableString(source.paymentRejectionReason, 300),
    finalPhotoUrl: cleanNullableString(source.finalPhotoUrl, 2000),
    bossApprovedAt: normalizeDateTime(source.bossApprovedAt),
    createdAt: normalizeDateTime(source.createdAt),
    updatedAt: normalizeDateTime(source.updatedAt),
  };
}

function normalizeMarketplaceEmergencyCall(input = {}) {
  if (!isRecord(input)) return null;
  const source = input;
  const createdAt = normalizeDateTime(source.createdAt);
  const updatedAt = normalizeDateTime(source.updatedAt);

  return {
    id: cleanString(source.id, 128),
    status: normalizeEmergencyStatus(source.status),
    dispatchMode: normalizeDispatchMode(source.dispatchMode || source.mode || source.serviceType),
    priority: cleanNullableString(source.priority, 40),
    issue: cleanNullableString(source.issue, 5000),
    location: cleanNullableString(source.location || source.address, 1000),
    phone: cleanNullableString(source.phone, 80),
    eta: normalizeNullableNumber(source.eta),
    clientId: cleanNullableString(source.clientId, 128),
    clientEmail: cleanNullableString(source.clientEmail, 320),
    clientName: cleanNullableString(source.clientName, 200),
    assignedEmployeeId: cleanNullableString(source.assignedEmployeeId, 128),
    assignedEmployeeEmail: cleanNullableString(source.assignedEmployeeEmail || source.employeeEmail, 320),
    assignedEmployeeName: cleanNullableString(source.assignedEmployeeName || source.employeeName, 200),
    quotedAmount: normalizeNullableNumber(source.quotedAmount),
    finalAmount: normalizeNullableNumber(source.finalAmount),
    clientRating: normalizeNullableNumber(source.clientRating),
    finalPhotoUrl: cleanNullableString(source.finalPhotoUrl, 2000),
    paymentProofUrl: cleanNullableString(source.paymentProofUrl, 2000),
    paymentProofAt: normalizeDateTime(source.paymentProofAt),
    paymentRejectionReason: cleanNullableString(source.paymentRejectionReason, 300),
    createdAt,
    updatedAt,
    createdAtMs: normalizeDateTimeMs(source.createdAtMs, createdAt),
    updatedAtMs: normalizeDateTimeMs(source.updatedAtMs, updatedAt),
    scheduledDate: cleanNullableString(source.scheduledDate, 20),
    scheduledTime: cleanNullableString(source.scheduledTime, 20),
    scheduledFor: normalizeDateTime(source.scheduledFor),
  };
}

function normalizeBossReviewQueueItem(input = {}) {
  if (!isRecord(input)) return null;
  const source = input;
  const sourceType = cleanString(source.sourceType, 20).toLowerCase();
  const paymentProofAt = normalizeDateTime(source.paymentProofAt);

  return {
    sourceType: sourceType === 'emergency' ? 'emergency' : 'request',
    sourceLabel: cleanNullableString(source.sourceLabel, 80),
    recordId: cleanString(source.recordId, 128),
    queueId: cleanString(source.queueId, 160),
    status: cleanString(source.status, 80),
    amount: normalizeNullableNumber(source.amount) || 0,
    paymentProofAt,
    paymentProofAtMs: normalizeDateTimeMs(source.paymentProofAtMs, paymentProofAt),
    paymentProofUrl: cleanNullableString(source.paymentProofUrl, 2000),
    employeeId: cleanNullableString(source.employeeId, 128),
    employeeName: cleanNullableString(source.employeeName, 200),
    employeeEmail: cleanNullableString(source.employeeEmail, 320),
    clientId: cleanNullableString(source.clientId, 128),
    clientName: cleanNullableString(source.clientName, 200),
    clientEmail: cleanNullableString(source.clientEmail, 320),
    description: cleanNullableString(source.description, 5000),
    address: cleanNullableString(source.address, 1000),
    createdAt: normalizeDateTime(source.createdAt),
    updatedAt: normalizeDateTime(source.updatedAt),
  };
}

function normalizeEmployeeDirectoryItem(input = {}) {
  if (!isRecord(input)) return null;
  const source = input;
  const id = cleanString(source.id || source.uid, 128);

  return {
    id,
    uid: cleanString(source.uid || source.id, 128) || id,
    name: cleanNullableString(source.name || source.displayName, 200),
    email: cleanNullableString(source.email, 320),
    phone: cleanNullableString(source.phone, 80),
    whatsappNumber: cleanNullableString(source.whatsappNumber, 80),
  };
}

function decorateRecord(input, normalizer) {
  const normalized = normalizer(input);
  if (!normalized) return null;
  if (!isRecord(input)) return normalized;
  return {
    ...input,
    ...normalized,
  };
}

function decorateList(items, decorator) {
  return Array.isArray(items)
    ? items.map((item) => decorator(item)).filter(Boolean)
    : [];
}

function decorateMarketplaceRequest(input) {
  return decorateRecord(input, normalizeMarketplaceRequest);
}

function decorateMarketplaceEmergencyCall(input) {
  return decorateRecord(input, normalizeMarketplaceEmergencyCall);
}

function decorateBossReviewQueueItem(input) {
  return decorateRecord(input, normalizeBossReviewQueueItem);
}

function decorateEmployeeDirectoryItem(input) {
  return decorateRecord(input, normalizeEmployeeDirectoryItem);
}

function decorateMarketplaceRequestList(items) {
  return decorateList(items, decorateMarketplaceRequest);
}

function decorateMarketplaceEmergencyCallList(items) {
  return decorateList(items, decorateMarketplaceEmergencyCall);
}

function decorateBossReviewQueue(items) {
  return decorateList(items, decorateBossReviewQueueItem);
}

function decorateEmployeeDirectory(items) {
  return decorateList(items, decorateEmployeeDirectoryItem)
    .filter((employee) => employee && employee.uid);
}

function buildMobileClientHomeResponse(requests = []) {
  const normalizedRequests = decorateMarketplaceRequestList(requests);

  const activeRequests = normalizedRequests.filter((request) => {
    return !REQUEST_TERMINAL_STATUSES.has(normalizeMarketplaceRequestStatus(request.status));
  }).length;
  const awaitingMyAction = normalizedRequests.filter((request) => {
    return CLIENT_ACTIONABLE_REQUEST_STATUSES.has(normalizeMarketplaceRequestStatus(request.status));
  }).length;
  const completedRequests = normalizedRequests.filter((request) => {
    return normalizeMarketplaceRequestStatus(request.status) === 'COMPLETADO';
  }).length;

  return {
    role: 'client',
    summary: {
      totalRequests: normalizedRequests.length,
      activeRequests,
      awaitingMyAction,
      completedRequests,
    },
  };
}

function buildMobileEmployeeHomeResponse(input = {}) {
  const source = isRecord(input) ? input : {};
  const employeeUid = cleanString(source.employeeUid, 128);
  const availableRequests = decorateMarketplaceRequestList(source.availableRequests);
  const myRequests = decorateMarketplaceRequestList(source.myRequests);
  const emergencyCalls = decorateMarketplaceEmergencyCallList(source.emergencyCalls);

  const assignedRequests = myRequests.filter((request) => {
    return EMPLOYEE_ASSIGNED_REQUEST_STATUSES.has(normalizeMarketplaceRequestStatus(request.status));
  }).length;

  const inProgressRequests = myRequests.filter((request) => {
    return EMPLOYEE_IN_PROGRESS_REQUEST_STATUSES.has(normalizeMarketplaceRequestStatus(request.status));
  }).length;

  const activeEmergencyCount = emergencyCalls.filter((call) => {
    return call.assignedEmployeeId === employeeUid
      && EMERGENCY_ACTIVE_STATUSES.has(normalizeEmergencyStatus(call.status));
  }).length;

  return {
    role: 'employee',
    summary: {
      openRequests: availableRequests.length,
      assignedRequests,
      inProgressRequests,
      activeEmergencyCount,
    },
  };
}

function buildMobileBossHomeResponse(input = {}) {
  const source = isRecord(input) ? input : {};
  const requests = decorateMarketplaceRequestList(source.requests);
  const emergencyCalls = decorateMarketplaceEmergencyCallList(source.emergencyCalls);
  const pendingPayments = decorateMarketplaceRequestList(source.pendingPayments);
  const reviewQueue = decorateBossReviewQueue(source.reviewQueue);

  const pendingRequests = requests.filter((request) => {
    return !REQUEST_TERMINAL_STATUSES.has(normalizeMarketplaceRequestStatus(request.status));
  }).length;

  const activeEmergencies = emergencyCalls.filter((call) => {
    return EMERGENCY_ACTIVE_STATUSES.has(normalizeEmergencyStatus(call.status));
  }).length;

  return {
    role: 'boss',
    summary: {
      pendingRequests,
      activeEmergencies,
      pendingPayments: pendingPayments.length,
      reviewQueue: reviewQueue.length,
    },
  };
}

module.exports = {
  MOBILE_ALLOWED_MIME_TYPES,
  DEFAULT_MOBILE_PHOTO_POLICY,
  DEFAULT_MOBILE_FEATURE_FLAGS,
  DEFAULT_MOBILE_COMPANY_CONFIG,
  REQUEST_TERMINAL_STATUSES,
  CLIENT_ACTIONABLE_REQUEST_STATUSES,
  EMPLOYEE_ASSIGNED_REQUEST_STATUSES,
  EMPLOYEE_IN_PROGRESS_REQUEST_STATUSES,
  EMERGENCY_ACTIVE_STATUSES,
  normalizeMobilePhotoPolicy,
  buildMobileFeatureFlags,
  buildMobileCompanyConfig,
  buildMobileBootstrapResponse,
  normalizeMarketplaceRequest,
  normalizeMarketplaceEmergencyCall,
  normalizeBossReviewQueueItem,
  normalizeEmployeeDirectoryItem,
  decorateMarketplaceRequest,
  decorateMarketplaceEmergencyCall,
  decorateBossReviewQueueItem,
  decorateEmployeeDirectoryItem,
  decorateMarketplaceRequestList,
  decorateMarketplaceEmergencyCallList,
  decorateBossReviewQueue,
  decorateEmployeeDirectory,
  buildMobileClientHomeResponse,
  buildMobileEmployeeHomeResponse,
  buildMobileBossHomeResponse,
};
