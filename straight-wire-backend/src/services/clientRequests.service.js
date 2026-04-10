'use strict';

// Firestore operations for clientRequests (client creation, boss view/assign, employee view).

const { admin, db } = require('../firebase');
const { appError, isFirestoreIndexRequiredError } = require('../utils/errors');

const COLLECTION = 'clientRequests';
const CLIENT_LOCKS_COLLECTION = 'clientLocks';

const ACTIVE_STATUSES = ['open', 'in_progress', 'awaiting_client_ok'];
const ACTIVE_FOR_CLIENT_UPLOAD = ['open', 'in_progress', 'awaiting_client_ok'];
const EMPLOYEE_ALLOWED_STATUSES = ['in_progress', 'awaiting_client_ok'];
const DONE_STATUSES = ['closed'];

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw appError(400, 'invalid_payload', `${label} is required.`);
  }
}

function normalizeStatusFilter(input) {
  const value = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (['open', 'in_progress', 'awaiting_client_ok', 'closed'].includes(value)) return value;
  return 'all';
}

function normalizePriority(raw) {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (['alta', 'high', 'urgente'].includes(value)) return 'high';
  if (['baja', 'low'].includes(value)) return 'low';
  if (['media', 'normal', 'medium'].includes(value)) return 'medium';
  return null;
}

function normalizeJobType(raw) {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (['residencial', 'residential'].includes(value)) return 'residential';
  if (['comercial', 'commercial'].includes(value)) return 'commercial';
  if (value) return value;
  return null;
}

function releaseClientLockTx(tx, clientUid, serverTimestamp) {
  if (!clientUid) return;
  const lockRef = db.collection(CLIENT_LOCKS_COLLECTION).doc(clientUid);
  tx.set(
    lockRef,
    {
      activeRequestId: null,
      updatedAt: serverTimestamp,
    },
    { merge: true },
  );
}

function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function serialize(doc) {
  if (!doc) return null;
  const data = doc.data();
  const assignedToValue = data.assignedToUid || data.assignedTo || null;
  return {
    id: doc.id,
    description: data.description || null,
    priority: data.priority || null,
    status: data.status || null,
    clientUid: data.clientUid || data.createdBy || null,
    clientEmail: data.clientEmail || null,
    clientSnapshot: data.clientSnapshot || null,
    jobType: data.jobType || null,
    assignedTo: assignedToValue,
    assignedToUid: assignedToValue,
    assignedToEmail: data.assignedToEmail || null,
    assignedAt: toIso(data.assignedAt),
    proofPhotos: Array.isArray(data.proofPhotos) ? data.proofPhotos : [],
    clientConfirmPhoto: data.clientConfirmPhoto || null,
    requestPhotoUrl: data.requestPhotoUrl || null,
    requestPhotoMeta: data.requestPhotoMeta || null,
    employeeWorkPhotoUrl: data.employeeWorkPhotoUrl || null,
    employeeWorkPhotoAt: toIso(data.employeeWorkPhotoAt),
    clientConfirmPhotoUrl: data.clientConfirmPhotoUrl || null,
    photoUrl: data.photoUrl || null, // backward compat
    photoUpdatedAt: toIso(data.photoUpdatedAt),
    clientOk: Boolean(data.clientOk),
    clientOkAt: toIso(data.clientOkAt),
    closedBy: data.closedBy || null,
    closedAt: toIso(data.closedAt),
    forcedByBoss: Boolean(data.forcedByBoss),
    forcedReason: data.forcedReason || null,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

function serializeDocData(doc) {
  return serialize({ id: doc.id, data: () => doc.data() });
}

async function findActiveRequestByClient(clientUid) {
  requireNonEmptyString(clientUid, 'clientUid');
  const collectionRef = db.collection(COLLECTION);
  const normalizedUid = clientUid.trim();

  try {
    const snap = await collectionRef
      .where('clientUid', '==', normalizedUid)
      .where('status', 'in', ACTIVE_STATUSES)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return null;
    return serializeDocData(snap.docs[0]);
  } catch (err) {
    if (!isFirestoreIndexRequiredError(err)) throw err;
    const snap = await collectionRef.where('clientUid', '==', normalizedUid).limit(10).get();
    const candidates = snap.docs.map(serializeDocData).filter(Boolean);
    const active = candidates.filter((doc) => ACTIVE_STATUSES.includes(doc.status));
    active.sort((a, b) => {
      const aMs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bMs - aMs;
    });
    return active[0] || null;
  }
}

async function listClientRequests(clientUid) {
  requireNonEmptyString(clientUid, 'clientUid');
  try {
    const snap = await db
      .collection(COLLECTION)
      .where('clientUid', '==', clientUid.trim())
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();
    return snap.docs.map(serializeDocData);
  } catch (err) {
    if (!isFirestoreIndexRequiredError(err)) throw err;
    const snap = await db.collection(COLLECTION).where('clientUid', '==', clientUid.trim()).limit(200).get();
    return snap.docs
      .map(serializeDocData)
      .sort((a, b) => {
        const aMs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bMs - aMs;
      });
  }
}

async function createClientRequest(clientUid, payload) {
  requireNonEmptyString(clientUid, 'clientUid');

  const email = typeof payload.clientEmail === 'string' ? payload.clientEmail.trim() : '';
  const description = typeof payload.description === 'string' ? payload.description.trim() : '';
  const address = typeof payload.address === 'string' ? payload.address.trim() : '';
  const priority = typeof payload.priority === 'string' ? payload.priority.trim() : '';
  const photos = Array.isArray(payload.photos)
    ? payload.photos.filter((p) => typeof p === 'string' && p.trim() !== '').map((p) => p.trim())
    : [];

  if (!email) {
    throw appError(400, 'invalid_payload', 'clientEmail is required.');
  }
  if (!description) {
    throw appError(400, 'invalid_payload', 'description is required.');
  }
  if (!address) {
    throw appError(400, 'invalid_payload', 'address is required.');
  }

  const ref = db.collection(COLLECTION).doc();
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  const doc = {
    createdBy: clientUid.trim(),
    clientEmail: email,
    description,
    address,
    priority: priority || null,
    photos: photos.length > 0 ? photos : null,
    status: 'open',
    assignedTo: null,
    createdAt: serverTimestamp,
    updatedAt: serverTimestamp,
    assignedAt: null,
  };

  await ref.set(doc);
  const fresh = await ref.get();
  return serializeDocData(fresh);
}

// Minimal creation for the simplified contract: description + priority.
async function createClientRequestSimple(clientUid, payload) {
  requireNonEmptyString(clientUid, 'clientUid');

  const description = typeof payload.description === 'string' ? payload.description.trim() : '';
  const priority = normalizePriority(payload.priority);
  const clientEmail = typeof payload.clientEmail === 'string' ? payload.clientEmail.trim() : null;
  const jobType = normalizeJobType(payload.jobType);
  const clientSnapshot = payload.clientSnapshot && typeof payload.clientSnapshot === 'object' ? payload.clientSnapshot : null;
  const requestPhotoUrl = typeof payload.requestPhotoUrl === 'string' ? payload.requestPhotoUrl.trim() : null;
  const requestPhotoMeta = payload.requestPhotoMeta && typeof payload.requestPhotoMeta === 'object' ? payload.requestPhotoMeta : null;

  if (!description || description.length < 5) {
    throw appError(400, 'invalid_payload', 'description is required.');
  }
  if (!priority) {
    throw appError(400, 'invalid_payload', 'priority is required.');
  }

  const ref = db.collection(COLLECTION).doc();
  const lockRef = db.collection(CLIENT_LOCKS_COLLECTION).doc(clientUid.trim());
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const lockSnap = await tx.get(lockRef);
    const lock = lockSnap.exists ? lockSnap.data() : {};
    const activeId = lock && typeof lock.activeRequestId === 'string' ? lock.activeRequestId.trim() : '';

    if (activeId) {
      const activeRef = db.collection(COLLECTION).doc(activeId);
      const activeSnap = await tx.get(activeRef);
      if (activeSnap.exists) {
        const activeStatus = String(activeSnap.data().status || '').toLowerCase();
        if (ACTIVE_STATUSES.includes(activeStatus)) {
          throw appError(409, 'active_request_exists', 'Ya tienes una solicitud en proceso. Debes finalizarla antes de crear otra.');
        }
      }
    }

    const doc = {
      description,
      priority,
      status: 'open',
      clientUid: clientUid.trim(),
      clientEmail: clientEmail || null,
      assignedTo: null,
      assignedToUid: null,
      assignedToEmail: null,
      assignedAt: null,
      jobType: jobType || null,
      clientSnapshot: clientSnapshot || null,
      proofPhotos: [],
      clientConfirmPhoto: null,
      requestPhotoUrl,
      requestPhotoMeta,
      employeeWorkPhotoUrl: null,
      employeeWorkPhotoAt: null,
      clientConfirmPhotoUrl: null,
      photoUrl: null,
      photoUpdatedAt: null,
      clientOk: false,
      clientOkAt: null,
      closedBy: null,
      closedAt: null,
      forcedByBoss: false,
      forcedReason: null,
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
    };

    tx.set(ref, doc);
    tx.set(
      lockRef,
      {
        activeRequestId: ref.id,
        updatedAt: serverTimestamp,
      },
      { merge: true },
    );
  });

  const fresh = await ref.get();
  return serializeDocData(fresh);
}

async function listRequestsForEmployeeTab(tab, employeeUid) {
  const collectionRef = db.collection(COLLECTION);
  try {
    let snap;
    const normalizedTab = typeof tab === 'string' ? tab.trim().toLowerCase() : 'all';
    if (normalizedTab === 'available') {
      snap = await collectionRef
        .where('status', '==', 'open')
        .where('assignedTo', '==', null)
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get();
    } else if (normalizedTab === 'mine') {
      if (!employeeUid) throw appError(400, 'invalid_payload', 'employeeUid is required for mine tab.');
      snap = await collectionRef
        .where('assignedTo', '==', employeeUid)
        .where('status', 'in', ['in_progress', 'awaiting_client_ok'])
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get();
    } else if (normalizedTab === 'finalized' || normalizedTab === 'done') {
      snap = await collectionRef.where('status', '==', 'closed').orderBy('createdAt', 'desc').limit(200).get();
    } else {
      snap = await collectionRef.orderBy('createdAt', 'desc').limit(200).get();
    }
    return snap.docs.map(serializeDocData);
  } catch (err) {
    if (!isFirestoreIndexRequiredError(err)) throw err;
    const snap = await collectionRef.limit(200).get();
    const normalizedTab = typeof tab === 'string' ? tab.trim().toLowerCase() : 'all';
    return snap.docs
      .map(serializeDocData)
      .filter((doc) => {
        if (!doc) return false;
        if (normalizedTab === 'available') return doc.status === 'open' && !doc.assignedTo;
        if (normalizedTab === 'mine')
          return doc.assignedTo === employeeUid && EMPLOYEE_ALLOWED_STATUSES.includes(doc.status);
        if (normalizedTab === 'finalized' || normalizedTab === 'done') return doc.status === 'closed';
        return true;
      })
      .sort((a, b) => {
        const aMs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bMs - aMs;
      });
  }
}

async function listAllRequestsForBoss() {
  try {
    const snap = await db.collection(COLLECTION).orderBy('createdAt', 'desc').limit(200).get();
    return snap.docs.map(serializeDocData);
  } catch (err) {
    if (!isFirestoreIndexRequiredError(err)) throw err;

    const snap = await db.collection(COLLECTION).limit(200).get();
    return snap.docs
      .map(serializeDocData)
      .sort((a, b) => {
        const aMs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bMs - aMs;
      });
  }
}

async function listBossRequests(statusFilter) {
  const normalized = normalizeStatusFilter(statusFilter);
  const collection = db.collection(COLLECTION);

  try {
    let snap;
    if (normalized === 'all') {
      snap = await collection.orderBy('createdAt', 'desc').limit(200).get();
    } else {
      snap = await collection.where('status', '==', normalized).orderBy('createdAt', 'desc').limit(200).get();
    }
    return snap.docs.map(serializeDocData);
  } catch (err) {
    if (!isFirestoreIndexRequiredError(err)) throw err;

    const snap = await collection.limit(200).get();
    return snap.docs
      .map(serializeDocData)
      .filter((doc) => normalized === 'all' || (doc && doc.status === normalized))
      .sort((a, b) => {
        const aMs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bMs - aMs;
      });
  }
}

async function listEmployeeAssignedRequests(employeeUid) {
  requireNonEmptyString(employeeUid, 'employeeUid');

  const baseQuery = db
    .collection(COLLECTION)
    .where('assignedTo', '==', employeeUid.trim())
    .where('status', 'in', EMPLOYEE_ALLOWED_STATUSES)
    .orderBy('assignedAt', 'desc');

  try {
    const snap = await baseQuery.get();
    return snap.docs.map(serializeDocData);
  } catch (err) {
    if (!isFirestoreIndexRequiredError(err)) throw err;

    // Fallback without composite index: two queries (assigned + in_progress).
    const results = [];
    for (const status of EMPLOYEE_ALLOWED_STATUSES) {
      const snap = await db
        .collection(COLLECTION)
        .where('assignedTo', '==', employeeUid.trim())
        .where('status', '==', status)
        .limit(200)
        .get();

      for (const doc of snap.docs) results.push(serializeDocData(doc));
    }

    // De-duplicate and sort by assignedAt desc.
    const seen = new Set();
    const unique = [];
    for (const item of results) {
      if (!item || !item.id || seen.has(item.id)) continue;
      seen.add(item.id);
      unique.push(item);
    }

    unique.sort((a, b) => {
      const aMs = a.assignedAt ? new Date(a.assignedAt).getTime() : 0;
      const bMs = b.assignedAt ? new Date(b.assignedAt).getTime() : 0;
      return bMs - aMs;
    });

    return unique;
  }
}

async function assignRequestToEmployee(requestId, employeeUid) {
  requireNonEmptyString(requestId, 'requestId');
  requireNonEmptyString(employeeUid, 'employeeUid');

  const ref = db.collection(COLLECTION).doc(requestId.trim());
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw appError(404, 'not_found', 'Request not found.');
    }

    const data = snap.data() || {};
    const status = typeof data.status === 'string' ? data.status.trim() : '';

    if (status !== 'open') {
      throw appError(409, 'already_assigned', 'Request is already assigned.');
    }

    tx.update(ref, {
      assignedTo: employeeUid.trim(),
      assignedToUid: employeeUid.trim(),
      assignedToEmail: null,
      assignedAt: serverTimestamp,
      status: 'in_progress',
      updatedAt: serverTimestamp,
    });
  });

  const fresh = await ref.get();
  return serializeDocData(fresh);
}

async function claimRequestTx(requestId, employeeUid, employeeEmail) {
  requireNonEmptyString(requestId, 'requestId');
  requireNonEmptyString(employeeUid, 'employeeUid');

  const ref = db.collection(COLLECTION).doc(requestId.trim());
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw appError(404, 'not_found', 'Not found');
    const data = snap.data() || {};
    const status = String(data.status || '').toLowerCase();
    if (status !== 'open' || data.assignedTo || data.assignedToUid) {
      throw appError(409, 'already_claimed', 'Request already assigned or not open');
    }
    tx.update(ref, {
      status: 'in_progress',
      assignedTo: employeeUid.trim(),
      assignedToUid: employeeUid.trim(),
      assignedToEmail: employeeEmail || null,
      assignedAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });
  });

  const fresh = await ref.get();
  return serializeDocData(fresh);
}

async function markAwaitingClientOk(requestId, employeeUid) {
  requireNonEmptyString(requestId, 'requestId');
  requireNonEmptyString(employeeUid, 'employeeUid');

  const ref = db.collection(COLLECTION).doc(requestId.trim());
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw appError(404, 'not_found', 'Not found');
    const data = snap.data() || {};
    if (data.assignedTo !== employeeUid || data.status !== 'in_progress') {
      throw appError(409, 'invalid_state', 'Cannot mark awaiting client.');
    }
    tx.update(ref, { status: 'awaiting_client_ok', updatedAt: serverTimestamp });
  });

  return { id: requestId.trim(), status: 'awaiting_client_ok' };
}

async function submitProofPhotos(requestId, employeeUid, proofUrls) {
  requireNonEmptyString(requestId, 'requestId');
  requireNonEmptyString(employeeUid, 'employeeUid');

  const urls = Array.isArray(proofUrls)
    ? proofUrls.filter((u) => typeof u === 'string' && u.trim() !== '').map((u) => u.trim())
    : [];

  if (urls.length === 0) {
    throw appError(400, 'invalid_payload', 'Proof photos are required.');
  }

  const ref = db.collection(COLLECTION).doc(requestId.trim());
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw appError(404, 'not_found', 'Not found');
    const data = snap.data() || {};
    const status = String(data.status || '').toLowerCase();

    if (data.assignedTo !== employeeUid) throw appError(403, 'forbidden', 'Forbidden');
    if (!['in_progress', 'awaiting_client_ok'].includes(status)) {
      throw appError(409, 'invalid_state', 'Cannot submit proof for this request.');
    }

    const mergedProofs = Array.isArray(data.proofPhotos) ? data.proofPhotos.slice() : [];
    for (const url of urls) {
      mergedProofs.push(url);
    }

    tx.update(ref, {
      proofPhotos: mergedProofs,
      status: 'awaiting_client_ok',
      updatedAt: serverTimestamp,
    });
  });

  const fresh = await ref.get();
  return serializeDocData(fresh);
}

async function approveRequestByClient(requestId, clientUid, confirmPhotoUrl) {
  requireNonEmptyString(requestId, 'requestId');
  requireNonEmptyString(clientUid, 'clientUid');

  const ref = db.collection(COLLECTION).doc(requestId.trim());
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw appError(404, 'not_found', 'Not found');
    const data = snap.data() || {};
    if (data.clientUid !== clientUid) throw appError(403, 'forbidden', 'Forbidden');
    if (String(data.status || '').toLowerCase() !== 'awaiting_client_ok') {
      throw appError(409, 'invalid_state', 'Cannot approve request.');
    }

    const historySnapshot = {
      requestId: ref.id,
      clientEmail: data.clientEmail || null,
      description: data.description || null,
      jobType: data.jobType || null,
      priority: data.priority || null,
      closedAt: serverTimestamp,
      employeeWorkPhotoUrl: data.employeeWorkPhotoUrl || null,
      clientConfirmPhotoUrl: confirmPhotoUrl || data.clientConfirmPhotoUrl || null,
      createdAt: serverTimestamp,
    };

    tx.update(ref, {
      clientOk: true,
      clientOkAt: serverTimestamp,
      clientConfirmPhoto: confirmPhotoUrl || data.clientConfirmPhoto || null,
      clientConfirmPhotoUrl: confirmPhotoUrl || data.clientConfirmPhotoUrl || null,
      status: 'closed',
      closedBy: 'client',
      closedAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });

    if (data.assignedTo) {
      const historyRef = db.collection('employees').doc(data.assignedTo).collection('history').doc(ref.id);
      tx.set(historyRef, historySnapshot, { merge: true });
      tx.set(
        db.collection('employees').doc(data.assignedTo),
        { jobsDoneCount: admin.firestore.FieldValue.increment(1) },
        { merge: true },
      );
    }

    releaseClientLockTx(tx, data.clientUid, serverTimestamp);
  });

  return { id: requestId.trim(), clientOk: true, status: 'closed', clientConfirmPhotoUrl: confirmPhotoUrl || null };
}

async function closeRequestByBoss(requestId, bossUid) {
  requireNonEmptyString(requestId, 'requestId');
  requireNonEmptyString(bossUid, 'bossUid');

  const ref = db.collection(COLLECTION).doc(requestId.trim());
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw appError(404, 'not_found', 'Not found');
    const data = snap.data() || {};
    if (!data.clientOk) {
      throw appError(409, 'client_ok_required', 'Client approval required');
    }
    const updates = {
      status: 'closed',
      closedBy: bossUid.trim(),
      closedAt: serverTimestamp,
      updatedAt: serverTimestamp,
    };
    tx.update(ref, updates);

    releaseClientLockTx(tx, data.clientUid, serverTimestamp);

    if (data.assignedTo) {
      const historyRef = db.collection('employees').doc(data.assignedTo).collection('history').doc(ref.id);
      tx.set(
        historyRef,
        {
          requestId: ref.id,
          status: 'closed',
          closedAt: serverTimestamp,
          snapshot: { ...data, ...updates },
        },
        { merge: true },
      );
    }
  });

  return { id: requestId.trim(), status: 'closed' };
}

async function forceUpdateByBoss(requestId, bossUid, payload = {}) {
  requireNonEmptyString(requestId, 'requestId');
  requireNonEmptyString(bossUid, 'bossUid');

  const ref = db.collection(COLLECTION).doc(requestId.trim());
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw appError(404, 'not_found', 'Not found');
    const data = snap.data() || {};

    const update = {
      updatedAt: serverTimestamp,
    };

    if (payload.status && typeof payload.status === 'string') {
      update.status = payload.status.trim().toLowerCase();
      if (update.status === 'closed' && !update.closedAt) {
        update.closedAt = serverTimestamp;
        update.closedBy = bossUid.trim();
      }
    }

    if ('assignedTo' in payload) {
      update.assignedTo =
        payload.assignedTo === null || payload.assignedTo === undefined
          ? null
          : String(payload.assignedTo).trim();
      update.assignedToUid = update.assignedTo;
      update.assignedAt = serverTimestamp;
    }

    if (payload.employeeProofPhotos) {
      update.employeeProofPhotos = Array.isArray(payload.employeeProofPhotos)
        ? payload.employeeProofPhotos
        : [];
    }

    if ('clientOkPhoto' in payload) {
      update.clientOkPhoto = payload.clientOkPhoto || null;
    }

    if (payload.forceOk) {
      update.clientOkPhoto =
        payload.clientOkPhoto ||
        {
          url: 'FORCED_OK',
          forced: true,
          createdAt: serverTimestamp,
        };
      update.clientOk = true;
      update.clientOkAt = serverTimestamp;
      if (!update.status) update.status = 'pending_boss_close';
    }

    const auditEntry = {
      action: 'force-update',
      byUid: bossUid,
      byRole: 'boss',
      at: serverTimestamp,
      payloadSummary: {
        status: update.status || data.status,
        assignedTo: update.assignedTo || data.assignedTo,
      },
    };

    const auditTrail = Array.isArray(data.auditTrail) ? data.auditTrail.slice() : [];
    auditTrail.push(auditEntry);
    const trimmedAudit = auditTrail.slice(-50);
    update.auditTrail = trimmedAudit;

    tx.update(ref, update);

    const assignedTo = update.assignedTo || data.assignedTo;
    if (update.status === 'closed' && assignedTo) {
      const historyRef = db.collection('employees').doc(assignedTo).collection('history').doc(ref.id);
      tx.set(historyRef, {
        requestId: ref.id,
        status: 'closed',
        closedAt: update.closedAt || serverTimestamp,
        snapshot: { ...data, ...update },
      });
    }

    if (data.clientUid && update.status === 'closed') {
      releaseClientLockTx(tx, data.clientUid, serverTimestamp);
    }
  });

  return { id: requestId.trim(), status: payload.status || undefined };
}

async function forceCloseByBoss(requestId, bossUid, reason) {
  requireNonEmptyString(requestId, 'requestId');
  requireNonEmptyString(bossUid, 'bossUid');

  const ref = db.collection(COLLECTION).doc(requestId.trim());
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw appError(404, 'not_found', 'Not found');
    const data = snap.data() || {};

    const auditEntry = {
      action: 'force-close',
      byUid: bossUid,
      byRole: 'boss',
      at: serverTimestamp,
      payloadSummary: { forced: true },
    };
    const auditTrail = Array.isArray(data.auditTrail) ? data.auditTrail.slice() : [];
    auditTrail.push(auditEntry);
    const trimmedAudit = auditTrail.slice(-50);

    const update = {
      status: 'closed',
      closedBy: bossUid,
      closedAt: serverTimestamp,
      updatedAt: serverTimestamp,
      forcedByBoss: true,
      forcedReason: typeof reason === 'string' && reason.trim() !== '' ? reason.trim() : data.forcedReason || null,
      auditTrail: trimmedAudit,
    };

    tx.update(ref, update);

    if (data.assignedTo) {
      const historyRef = db.collection('employees').doc(data.assignedTo).collection('history').doc(ref.id);
      tx.set(historyRef, {
        requestId: ref.id,
        status: 'closed',
        closedAt: serverTimestamp,
        snapshot: { ...data, ...update },
      });
    }

    if (data.clientUid) {
      releaseClientLockTx(tx, data.clientUid, serverTimestamp);
    }
  });

  return { id: requestId.trim(), status: 'closed' };
}

async function attachPhotoForClient(requestId, clientUid, url) {
  requireNonEmptyString(requestId, 'requestId');
  requireNonEmptyString(clientUid, 'clientUid');
  requireNonEmptyString(url, 'photoUrl');

  const ref = db.collection(COLLECTION).doc(requestId.trim());
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw appError(404, 'not_found', 'Not found');
    const data = snap.data() || {};

    const status = String(data.status || '').toLowerCase();
    if (data.clientUid !== clientUid) throw appError(403, 'forbidden', 'Forbidden');
    if (!ACTIVE_FOR_CLIENT_UPLOAD.includes(status)) throw appError(409, 'invalid_state', 'Request is not active.');

    tx.update(ref, {
      photoUrl: url,
      photoUpdatedAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });
  });

  return { id: requestId.trim(), photoUrl: url };
}

module.exports = {
  createClientRequest,
  createClientRequestSimple,
  findActiveRequestByClient,
  listClientRequests,
  listRequestsForEmployeeTab,
  listAllRequestsForBoss,
  listBossRequests,
  listEmployeeAssignedRequests,
  assignRequestToEmployee,
  claimRequestTx,
  markAwaitingClientOk,
  submitProofPhotos,
  approveRequestByClient,
  closeRequestByBoss,
  forceUpdateByBoss,
  forceCloseByBoss,
  attachPhotoForClient,
  EMPLOYEE_ALLOWED_STATUSES,
};
