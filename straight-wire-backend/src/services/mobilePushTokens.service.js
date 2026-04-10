'use strict';

const { admin, db } = require('../firebase');
const { appError } = require('../utils/errors');
const {
  hashPushToken,
  normalizeRegisterPushTokenPayload,
  normalizePushTokenParam,
} = require('../utils/mobilePushTokens');

const MOBILE_PUSH_TOKENS_COLLECTION = 'mobilePushTokens';

function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeMobileRole(value) {
  const role = cleanString(value).toLowerCase();
  if (role === 'boss') return 'boss';
  if (role === 'client') return 'client';
  return 'employee';
}

async function registerMobilePushToken(staff, payload) {
  const uid = cleanString(staff && staff.uid);
  if (!uid) {
    throw appError(401, 'unauthorized', 'Usuario no autenticado.');
  }

  const normalized = normalizeRegisterPushTokenPayload(payload);
  if (!normalized.token) {
    throw appError(400, 'invalid_input', 'token es requerido.');
  }

  if (!normalized.platform) {
    throw appError(400, 'invalid_input', 'platform debe ser ios o android.');
  }

  if (!normalized.deviceId) {
    throw appError(400, 'invalid_input', 'deviceId es requerido.');
  }

  const tokenId = hashPushToken(normalized.token);
  const ref = db.collection(MOBILE_PUSH_TOKENS_COLLECTION).doc(tokenId);
  const record = {
    uid,
    role: normalizeMobileRole(staff.role),
    token: normalized.token,
    tokenId,
    platform: normalized.platform,
    appVersion: normalized.appVersion || null,
    deviceId: normalized.deviceId,
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  };

  await ref.set(record, { merge: true });
  return record;
}

async function unregisterMobilePushToken(staff, rawToken) {
  const uid = cleanString(staff && staff.uid);
  if (!uid) {
    throw appError(401, 'unauthorized', 'Usuario no autenticado.');
  }

  const token = normalizePushTokenParam(rawToken);
  if (!token) {
    throw appError(400, 'invalid_input', 'token es requerido.');
  }

  const tokenId = hashPushToken(token);
  const ref = db.collection(MOBILE_PUSH_TOKENS_COLLECTION).doc(tokenId);
  const snap = await ref.get();

  if (!snap.exists) {
    return {
      ok: true,
      deleted: false,
      tokenId,
    };
  }

  const data = snap.data() || {};
  if (cleanString(data.uid) && cleanString(data.uid) !== uid) {
    throw appError(403, 'forbidden', 'No puedes eliminar un token de otro usuario.');
  }

  await ref.delete();
  return {
    ok: true,
    deleted: true,
    tokenId,
  };
}

module.exports = {
  registerMobilePushToken,
  unregisterMobilePushToken,
};
