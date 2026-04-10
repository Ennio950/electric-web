'use strict';

// Request/job messages stored under: jobs/{jobId}/messages/{messageId}

const { admin, db } = require('../firebase');
const { appError } = require('../utils/errors');

const JOBS_COLLECTION = 'jobs';
const MESSAGES_SUBCOLLECTION = 'messages';

function normalizeLimit(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 200);
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw appError(400, 'invalid_payload', `${label} is required.`);
  }
}

function mapDoc(doc) {
  return { id: doc.id, ...doc.data() };
}

function messagesRef(jobId) {
  return db.collection(JOBS_COLLECTION).doc(jobId).collection(MESSAGES_SUBCOLLECTION);
}

async function listMessages(jobId, options = {}) {
  requireNonEmptyString(jobId, 'id');
  const limit = normalizeLimit(options.limit, 200);

  const snap = await messagesRef(jobId).orderBy('createdAt', 'asc').limit(limit).get();
  return snap.docs.map(mapDoc);
}

async function addMessage(jobId, payload) {
  requireNonEmptyString(jobId, 'id');
  if (!payload || typeof payload !== 'object') {
    throw appError(400, 'invalid_payload', 'Message payload is required.');
  }

  const byUid = payload.byUid;
  const byRole = payload.byRole;
  const text = payload.text;

  requireNonEmptyString(byUid, 'byUid');
  requireNonEmptyString(byRole, 'byRole');
  requireNonEmptyString(text, 'text');

  const ref = messagesRef(jobId).doc();

  await ref.set({
    byUid: byUid.trim(),
    byRole: byRole.trim(),
    text: text.trim(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const snap = await ref.get();
  return mapDoc(snap);
}

module.exports = {
  listMessages,
  addMessage,
};

