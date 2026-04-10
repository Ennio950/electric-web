'use strict';

const { auth, db } = require('../firebase');
const { getCompanyConfig } = require('./companyConfig.service');
const { getNotificationSettings } = require('./notificationSettings.service');
const { normalizeE164, sendWhatsAppNotification } = require('./whatsappNotifications.service');

const BOSS_COMMISSION_RATE = 0.20;
const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

function cleanString(value, max = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '$0.00';
  return moneyFormatter.format(amount);
}

function resolveSourceLabel(sourceType) {
  return String(sourceType || '').trim().toLowerCase() === 'emergency' ? 'Emergencia' : 'Solicitud';
}

function buildCaseCode(sourceType, recordId) {
  const label = resolveSourceLabel(sourceType);
  const id = cleanString(recordId, 120);
  return id ? `${label} ${id}` : label;
}

function composeMessage(companyName, title, lines = []) {
  return [
    companyName ? `[${companyName}]` : '[Electric Web]',
    cleanString(title, 120),
    '',
    ...lines.map((line) => cleanString(line, 240)).filter(Boolean),
  ].join('\n').trim();
}

async function resolveUserWhatsAppTarget(uid, fallback = {}) {
  const explicit = normalizeE164(
    fallback.whatsappNumber
    || fallback.whatsapp
    || fallback.phone
    || fallback.phoneNumber
    || fallback.mobile
    || fallback.telefono
    || fallback.celular
  );
  if (explicit) return explicit;

  const userUid = cleanString(uid, 200);
  if (!userUid) return '';

  const refs = [
    db.collection('users').doc(userUid).get().catch(() => null),
    db.collection('employees').doc(userUid).get().catch(() => null),
    auth.getUser(userUid).catch(() => null),
  ];

  const [userSnap, employeeSnap, authUser] = await Promise.all(refs);

  const userData = userSnap && userSnap.exists ? userSnap.data() || {} : {};
  const employeeData = employeeSnap && employeeSnap.exists ? employeeSnap.data() || {} : {};

  const candidates = [
    userData.whatsappNumber,
    userData.whatsapp,
    userData.phone,
    userData.phoneNumber,
    userData.mobile,
    userData.telefono,
    userData.celular,
    employeeData.whatsappNumber,
    employeeData.whatsapp,
    employeeData.phone,
    employeeData.phoneNumber,
    employeeData.mobile,
    employeeData.telefono,
    employeeData.celular,
    authUser?.phoneNumber,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeE164(candidate);
    if (normalized) return normalized;
  }

  return '';
}

async function sendBossWhatsAppAlert({ eventType, title, lines, metadata } = {}) {
  const [companyConfig, notificationSettings] = await Promise.all([
    getCompanyConfig(),
    getNotificationSettings(),
  ]);
  return sendWhatsAppNotification({
    companyConfig,
    settings: notificationSettings.whatsapp,
    to: notificationSettings?.whatsapp?.alertNumber || companyConfig.whatsappNumber || '',
    eventType,
    message: composeMessage(companyConfig.displayName, title, lines),
    metadata,
  });
}

async function sendEmployeeWhatsAppAlert({ employeeUid, fallbackRecipient, eventType, title, lines, metadata } = {}) {
  const [companyConfig, notificationSettings] = await Promise.all([
    getCompanyConfig(),
    getNotificationSettings(),
  ]);
  const to = await resolveUserWhatsAppTarget(employeeUid, fallbackRecipient);
  return sendWhatsAppNotification({
    companyConfig,
    settings: notificationSettings.whatsapp,
    to,
    eventType,
    message: composeMessage(companyConfig.displayName, title, lines),
    metadata,
  });
}

async function notifyBossPaymentPendingReview(input = {}) {
  const amount = Number(input.amount || 0);
  const deposit = Number.isFinite(amount) ? amount * BOSS_COMMISSION_RATE : 0;
  const sourceLabel = resolveSourceLabel(input.sourceType);
  const caseCode = buildCaseCode(input.sourceType, input.recordId);

  return sendBossWhatsAppAlert({
    eventType: `payment_pending_review_${String(input.sourceType || 'request').toLowerCase()}`,
    title: 'Nuevo comprobante por revisar',
    lines: [
      caseCode,
      input.employeeName ? `Tecnico: ${input.employeeName}` : '',
      input.clientName ? `Cliente: ${input.clientName}` : '',
      Number.isFinite(amount) && amount > 0 ? `Trabajo: ${formatMoney(amount)}` : '',
      deposit > 0 ? `Deposito esperado 20%: ${formatMoney(deposit)}` : '',
      input.address ? `Ubicacion: ${input.address}` : '',
      `Accion: revisa ${sourceLabel.toLowerCase()} en Panel Jefe > Pagos pendientes.`,
    ],
    metadata: {
      sourceType: String(input.sourceType || 'request').toLowerCase(),
      recordId: cleanString(input.recordId, 120),
      employeeUid: cleanString(input.employeeUid, 200),
      employeeName: cleanString(input.employeeName, 160),
      clientName: cleanString(input.clientName, 160),
    },
  });
}

async function notifyEmployeeAssignedRequest(input = {}) {
  return sendEmployeeWhatsAppAlert({
    employeeUid: input.employeeUid,
    eventType: 'request_assigned',
    title: 'Nuevo trabajo asignado',
    lines: [
      buildCaseCode('request', input.recordId),
      input.clientName ? `Cliente: ${input.clientName}` : '',
      input.category ? `Categoria: ${input.category}` : '',
      input.address ? `Direccion: ${input.address}` : '',
      input.description ? `Detalle: ${input.description}` : '',
      'Accion: entra a tu panel de empleado para atenderlo.',
    ],
    metadata: {
      sourceType: 'request',
      recordId: cleanString(input.recordId, 120),
      employeeUid: cleanString(input.employeeUid, 200),
    },
  });
}

async function notifyEmployeeDepositRequired(input = {}) {
  const amount = Number(input.amount || 0);
  const deposit = Number.isFinite(amount) ? amount * BOSS_COMMISSION_RATE : 0;

  return sendEmployeeWhatsAppAlert({
    employeeUid: input.employeeUid,
    fallbackRecipient: input.fallbackRecipient,
    eventType: `deposit_required_${String(input.sourceType || 'request').toLowerCase()}`,
    title: 'Debes subir tu comprobante',
    lines: [
      buildCaseCode(input.sourceType, input.recordId),
      input.clientName ? `Cliente: ${input.clientName}` : '',
      Number.isFinite(amount) && amount > 0 ? `Monto cobrado: ${formatMoney(amount)}` : '',
      deposit > 0 ? `Deposito requerido 20%: ${formatMoney(deposit)}` : '',
      input.address ? `Ubicacion: ${input.address}` : '',
      'Accion: deposita el 20% y sube tu comprobante en el panel.',
    ],
    metadata: {
      sourceType: String(input.sourceType || 'request').toLowerCase(),
      recordId: cleanString(input.recordId, 120),
      employeeUid: cleanString(input.employeeUid, 200),
    },
  });
}

async function notifyEmployeeProofRejected(input = {}) {
  return sendEmployeeWhatsAppAlert({
    employeeUid: input.employeeUid,
    fallbackRecipient: input.fallbackRecipient,
    eventType: `payment_rejected_${String(input.sourceType || 'request').toLowerCase()}`,
    title: 'Comprobante rechazado',
    lines: [
      buildCaseCode(input.sourceType, input.recordId),
      input.reason ? `Motivo: ${input.reason}` : 'Motivo: revisa el comprobante enviado.',
      input.address ? `Ubicacion: ${input.address}` : '',
      'Accion: reenvia un nuevo comprobante para continuar.',
    ],
    metadata: {
      sourceType: String(input.sourceType || 'request').toLowerCase(),
      recordId: cleanString(input.recordId, 120),
      employeeUid: cleanString(input.employeeUid, 200),
    },
  });
}

module.exports = {
  resolveUserWhatsAppTarget,
  notifyBossPaymentPendingReview,
  notifyEmployeeAssignedRequest,
  notifyEmployeeDepositRequired,
  notifyEmployeeProofRejected,
};
