'use strict';

// Controllers for client/employee/boss flows on clientRequests.

const { admin, db } = require('../firebase');
const {
  createClientRequestSimple,
  findActiveRequestByClient,
  listClientRequests,
  listAllRequestsForBoss,
  listRequestsForEmployeeTab,
  assignRequestToEmployee,
  claimRequestTx,
  submitProofPhotos,
  markAwaitingClientOk,
  approveRequestByClient,
  closeRequestByBoss,
  forceUpdateByBoss,
  forceCloseByBoss,
  attachPhotoForClient,
} = require('../services/clientRequests.service');
const { getEmployeeProfile } = require('../services/employeeProfile.service');
const { notifyEmployeeAssignedRequest } = require('../services/operationalAlerts.service');
const { createLogger } = require('../utils/logger');

const logger = createLogger('clientRequests');

function sendOk(res, data, status = 200, meta) {
  const payload = meta ? { data, meta } : { data };
  return res.status(status).json(payload);
}

function sendErr(res, status, message) {
  return res.status(status).json({ message });
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function runDetached(label, task) {
  Promise.resolve()
    .then(task)
    .catch((error) => {
      logger.warn(`${label} alert failed:`, error?.message || error);
    });
}

async function buildClientSnapshot(uid, fallbackEmail) {
  try {
    const snap = await db.collection('users').doc(uid).get();
    const data = snap.exists ? snap.data() || {} : {};
    return {
      name: normalizeString(data.name || data.displayName || data.nombre),
      phone: normalizeString(data.phone || data.telefono),
      email: normalizeString(data.email || fallbackEmail || data.correo),
      address: normalizeString(data.address || data.direccion),
    };
  } catch (err) {
    logger.warn('Could not read client profile', err);
    return {
      name: '',
      phone: '',
      email: normalizeString(fallbackEmail),
      address: '',
    };
  }
}

function handleServiceError(res, err, fallbackMsg = 'Request failed.') {
  if (err && typeof err.status === 'number') {
    const status = err.status;
    const message = err.message || fallbackMsg;
    return sendErr(res, status, message);
  }
  logger.error('Unexpected error', err);
  return sendErr(res, 500, 'Internal Server Error');
}

// ------------------------
// Client: create request
// ------------------------
async function postClientCreateRequest(req, res) {
  const uid = req.user && req.user.uid;
  const role = req.user && req.user.role;
  const tokenEmail = req.user && req.user.email;

  if (!uid) return sendErr(res, 401, 'Token invalido o expirado.');
  if (role !== 'client') return sendErr(res, 403, 'Client role required.');

  const body = req.body || {};
  const description = normalizeString(body.description);
  const priorityRaw = normalizeString(body.priority);
  const jobType = normalizeString(body.jobType);

  if (!description || description.length < 5 || !priorityRaw) {
    logger.debug('Validation failed for POST /api/client/requests', {
      descriptionLength: description.length,
      priority: priorityRaw,
    });
    return sendErr(res, 400, 'Invalid request body');
  }

  const clientSnapshot = await buildClientSnapshot(uid, tokenEmail || body.clientEmail);
  const payload = {
    clientEmail: normalizeString(body.clientEmail || tokenEmail),
    description,
    priority: priorityRaw,
    jobType,
    clientSnapshot,
  };

  try {
    logger.debug('POST /api/client/requests received by', uid);
    const created = await createClientRequestSimple(uid, payload);
    const meta = { created: true };
    logger.info('Created request', created.id, 'by', uid);
    return sendOk(res, created, 201, meta);
  } catch (err) {
    if (err && err.status === 400) {
      return sendErr(res, 400, 'Invalid request body');
    }
    return handleServiceError(res, err, 'Request failed.');
  }
}

// ------------------------
// Client: active + history
// ------------------------
async function getClientActiveRequest(req, res) {
  const uid = req.user && req.user.uid;
  if (!uid) return sendErr(res, 401, 'Token invalido o expirado.');

  try {
    const active = await findActiveRequestByClient(uid);
    logger.debug('Active request for client', uid, '->', active ? active.id : null);
    return sendOk(res, active || null, 200);
  } catch (err) {
    return handleServiceError(res, err, 'Failed to fetch active request.');
  }
}

async function getClientRequestsHistory(req, res) {
  const uid = req.user && req.user.uid;
  if (!uid) return sendErr(res, 401, 'Token invalido o expirado.');

  try {
    const list = await listClientRequests(uid);
    const firstId = list.length > 0 ? list[0].id : null;
    logger.debug('History fetched for client', uid, 'count', list.length, 'firstId', firstId);
    return sendOk(res, list, 200, { count: list.length, firstId });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to fetch client requests.');
  }
}

// ------------------------
// Employee list
// ------------------------
async function getEmployeeRequests(req, res) {
  const role = req.user && req.user.role;
  if (!role || (role !== 'employee' && role !== 'boss')) {
    return sendErr(res, 403, 'Employee role required.');
  }

  try {
    const tabParam = typeof req.query?.tab === 'string' ? req.query.tab : req.query?.scope;
    const tab = typeof tabParam === 'string' ? tabParam.trim().toLowerCase() : 'all';
    const employeeUid = req.user && req.user.uid;
    logger.debug('GET /api/employee/requests received', { uid: employeeUid, tab });
    const requests = await listRequestsForEmployeeTab(tab || 'all', employeeUid);
    const firstId = requests.length > 0 && requests[0] && requests[0].id ? requests[0].id : null;
    logger.debug('Employee fetched requests count:', requests.length, 'firstId:', firstId);
    return sendOk(res, requests, 200, { count: requests.length, firstId, tab: tab || 'all' });
  } catch (err) {
    return handleServiceError(res, err, 'Internal Server Error');
  }
}

// ------------------------
// Boss list
// ------------------------
async function getBossRequests(req, res) {
  const role = req.user && req.user.role;
  if (role !== 'boss') {
    return sendErr(res, 403, 'Boss role required.');
  }

  try {
    logger.debug('GET /api/boss/requests received');
    const requests = await listAllRequestsForBoss();
    const firstId = requests.length > 0 && requests[0] && requests[0].id ? requests[0].id : null;
    logger.debug('Boss fetched requests count:', requests.length, 'firstId:', firstId);
    return sendOk(res, requests, 200, { count: requests.length, firstId });
  } catch (err) {
    return handleServiceError(res, err, 'Internal Server Error');
  }
}

// ------------------------
// Boss assign
// ------------------------
async function postBossAssignRequest(req, res) {
  const role = req.user && req.user.role;
  if (role !== 'boss') {
    return sendErr(res, 403, 'Boss role required.');
  }

  const requestId = normalizeString(req.body && req.body.requestId);
  const employeeUid = normalizeString(req.body && (req.body.employeeUid || req.body.assigneeId));

  if (!requestId || !employeeUid) {
    return sendErr(res, 400, 'Invalid request body');
  }

  try {
    logger.debug('POST /api/boss/assign-request received', { requestId, employeeUid });
    const updated = await assignRequestToEmployee(requestId, employeeUid);
    runDetached('employee assigned request', () => notifyEmployeeAssignedRequest({
      employeeUid,
      recordId: updated.id,
      clientName: updated.clientSnapshot?.name || updated.clientEmail || '',
      category: updated.jobType || '',
      address: updated.clientSnapshot?.address || '',
      description: updated.description || '',
    }));
    return sendOk(res, updated, 200);
  } catch (err) {
    return handleServiceError(res, err, 'Request failed.');
  }
}

// ------------------------
// Employee claim
// ------------------------
async function postEmployeeClaimRequest(req, res) {
  const uid = req.user && req.user.uid;
  const role = req.user && req.user.role;
  const email = req.user && req.user.email;

  if (!uid || (role !== 'employee' && role !== 'boss')) {
    return sendErr(res, 403, 'Employee role required.');
  }

  const requestId = normalizeString(req.params && req.params.id);
  if (!requestId) return sendErr(res, 400, 'Invalid request body');

  try {
    logger.debug('Claim request received', { uid, requestId });
    const result = await claimRequestTx(requestId, uid, email || null);
    logger.info('Claim result', { uid, requestId, status: result.status });
    return sendOk(res, result, 200);
  } catch (err) {
    if (err && err.status === 409) {
      return sendErr(res, 409, 'Request already assigned or not open');
    }
    return handleServiceError(res, err, 'Request failed.');
  }
}

// ------------------------
// Employee submit proof -> awaiting client ok
// ------------------------
async function postEmployeeSubmitProof(req, res) {
  const uid = req.user && req.user.uid;
  const role = req.user && req.user.role;
  if (!uid || role !== 'employee') return sendErr(res, 403, 'Employee role required.');

  const requestId = normalizeString(req.params && req.params.id);
  if (!requestId) return sendErr(res, 400, 'Invalid request body');

  const body = req.body || {};
  const proofUrlsRaw = Array.isArray(body.proofUrls) ? body.proofUrls : body.proofPhotos || [];
  const proofUrlSingle = normalizeString(body.proofUrl || body.photoUrl);
  const proofUrls =
    proofUrlsRaw && Array.isArray(proofUrlsRaw)
      ? proofUrlsRaw
      : proofUrlSingle
        ? [proofUrlSingle]
        : [];

  try {
    const updated = await submitProofPhotos(requestId, uid, proofUrls);
    logger.info('Employee submitted proof', { uid, requestId, proofCount: proofUrls.length });
    return sendOk(res, updated, 200);
  } catch (err) {
    return handleServiceError(res, err, 'Request failed.');
  }
}

// ------------------------
// Employee mark awaiting (legacy)
// ------------------------
async function postEmployeeMarkAwaiting(req, res) {
  const uid = req.user && req.user.uid;
  const role = req.user && req.user.role;

  if (!uid || role !== 'employee') {
    return sendErr(res, 403, 'Employee role required.');
  }

  const requestId = normalizeString(req.params && req.params.id);
  if (!requestId) return sendErr(res, 400, 'Invalid request body');

  try {
    const result = await markAwaitingClientOk(requestId, uid);
    logger.info('Employee marked awaiting client OK', { uid, requestId });
    return sendOk(res, result, 200);
  } catch (err) {
    return handleServiceError(res, err, 'Request failed.');
  }
}

// ------------------------
// Client confirm/approve
// ------------------------
async function postClientConfirmRequest(req, res) {
  const uid = req.user && req.user.uid;
  const role = req.user && req.user.role;

  if (!uid || role !== 'client') {
    return sendErr(res, 403, 'Client role required.');
  }

  const requestId = normalizeString(req.params && req.params.id);
  if (!requestId) return sendErr(res, 400, 'Invalid request body');

  const confirmPhotoUrl = normalizeString(req.body && (req.body.confirmPhotoUrl || req.body.photoUrl));
  if (!confirmPhotoUrl) return sendErr(res, 400, 'Invalid request body');

  try {
    const result = await approveRequestByClient(requestId, uid, confirmPhotoUrl || null);
    logger.info('Client confirmed request', { uid, requestId });
    return sendOk(res, result, 200);
  } catch (err) {
    return handleServiceError(res, err, 'Request failed.');
  }
}

// ------------------------
// Boss close
// ------------------------
async function postBossCloseRequest(req, res) {
  const uid = req.user && req.user.uid;
  const role = req.user && req.user.role;

  if (!uid || role !== 'boss') {
    return sendErr(res, 403, 'Boss role required.');
  }

  const requestId = normalizeString(req.params && req.params.id);
  if (!requestId) return sendErr(res, 400, 'Invalid request body');

  try {
    const result = await closeRequestByBoss(requestId, uid);
    logger.info('Boss closed request', { uid, requestId });
    return sendOk(res, result, 200);
  } catch (err) {
    if (err && err.status === 409) return sendErr(res, 409, 'Client approval required');
    return handleServiceError(res, err, 'Request failed.');
  }
}

// ------------------------
// Boss force update / close
// ------------------------
async function patchBossForce(req, res) {
  const uid = req.user && req.user.uid;
  const role = req.user && req.user.role;
  if (role !== 'boss') {
    return sendErr(res, 403, 'Boss role required.');
  }

  const requestId = normalizeString(req.params && req.params.id);
  if (!requestId) return sendErr(res, 400, 'Invalid request body');

  const payload = req.body || {};

  try {
    const result = await forceUpdateByBoss(requestId, uid, payload);
    logger.info('Boss force update', { uid, requestId, status: result.status });
    return sendOk(res, result, 200);
  } catch (err) {
    return handleServiceError(res, err, 'Request failed.');
  }
}

async function postBossForceClose(req, res) {
  const uid = req.user && req.user.uid;
  const role = req.user && req.user.role;
  if (role !== 'boss') {
    return sendErr(res, 403, 'Boss role required.');
  }

  const requestId = normalizeString(req.params && req.params.id);
  if (!requestId) return sendErr(res, 400, 'Invalid request body');

  const reason = normalizeString(req.body && req.body.reason);

  try {
    const result = await forceCloseByBoss(requestId, uid, reason || null);
    logger.info('Boss force close', { uid, requestId });
    return sendOk(res, result, 200);
  } catch (err) {
    return handleServiceError(res, err, 'Request failed.');
  }
}

// ------------------------
// Employee profile for client/boss
// ------------------------
async function getEmployeeProfileForClient(req, res) {
  const requesterUid = req.user && req.user.uid;
  const role = req.user && req.user.role;
  const employeeUid = normalizeString(req.params && req.params.employeeUid);
  const requestId = normalizeString(req.query && req.query.requestId);

  if (!employeeUid) return sendErr(res, 400, 'Invalid request body');

  try {
    if (role === 'boss') {
      const profile = await getEmployeeProfile(employeeUid);
      return sendOk(res, profile, 200);
    }

    if (role === 'employee') {
      if (employeeUid !== requesterUid) return sendErr(res, 403, 'Forbidden');
      const profile = await getEmployeeProfile(employeeUid);
      return sendOk(res, profile, 200);
    }

    if (role === 'client') {
      const profile = await getEmployeeProfile(employeeUid, {
        requesterUid,
        requesterRole: 'client',
        requestId,
      });
      return sendOk(res, profile, 200);
    }

    return sendErr(res, 403, 'Forbidden');
  } catch (err) {
    return handleServiceError(res, err, 'Request failed.');
  }
}

// ------------------------
// Optional photo upload (client)
// ------------------------
function parseMultipartPhoto(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = /boundary=(.+);?/.exec(contentType);
    if (!boundaryMatch) {
      return reject(new Error('Invalid multipart form data'));
    }
    const boundary = '--' + boundaryMatch[1];
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const parts = buffer.toString('binary').split(boundary);
      for (const part of parts) {
        if (part.includes('name="photo"')) {
          const splitIndex = part.indexOf('\r\n\r\n');
          if (splitIndex === -1) continue;
          const headers = part.slice(0, splitIndex);
          const body = part.slice(splitIndex + 4, part.lastIndexOf('\r\n'));
          const filenameMatch = /filename="([^"]+)"/.exec(headers);
          const contentTypeMatch = /Content-Type: ([^\r\n]+)/.exec(headers);
          const fileBuffer = Buffer.from(body, 'binary');
          return resolve({
            buffer: fileBuffer,
            filename: filenameMatch ? filenameMatch[1] : 'upload.bin',
            contentType: contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream',
          });
        }
      }
      reject(new Error('photo not found'));
    });
    req.on('error', reject);
  });
}

async function postClientUploadPhoto(req, res) {
  const uid = req.user && req.user.uid;
  const role = req.user && req.user.role;
  if (!uid || role !== 'client') {
    return sendErr(res, 403, 'Client role required.');
  }

  const requestId = normalizeString(req.params && req.params.id);
  if (!requestId) return sendErr(res, 400, 'Invalid request body');

  let photoBuffer;
  let filename;
  try {
    const parsed = await parseMultipartPhoto(req);
    photoBuffer = parsed.buffer;
    filename = parsed.filename;
  } catch (err) {
    logger.error('photo parse failed', err);
    return sendErr(res, 400, 'Invalid photo upload');
  }

  const bucket = admin.storage().bucket();
  const dest = `clientRequests/${requestId}/${Date.now()}_${filename || 'photo'}`;
  let publicUrl;

  try {
    const file = bucket.file(dest);
    await file.save(photoBuffer, { resumable: false, public: true });
    publicUrl = file.publicUrl();
  } catch (err) {
    logger.error('photo upload failed', err);
    return sendErr(res, 500, 'Upload failed');
  }

  try {
    const result = await attachPhotoForClient(requestId, uid, publicUrl);
    return sendOk(res, result, 200);
  } catch (err) {
    return handleServiceError(res, err, 'Request failed.');
  }
}

module.exports = {
  postClientCreateRequest,
  getClientActiveRequest,
  getClientRequestsHistory,
  getBossRequests,
  getEmployeeRequests,
  postBossAssignRequest,
  postEmployeeClaimRequest,
  postEmployeeSubmitProof,
  postEmployeeMarkAwaiting,
  postClientConfirmRequest,
  postClientApprove: postClientConfirmRequest,
  postBossCloseRequest,
  patchBossForce,
  postBossForceClose,
  getEmployeeProfileForClient,
  postClientUploadPhoto,
};
