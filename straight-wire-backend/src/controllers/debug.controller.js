'use strict';

const { db } = require('../firebase');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const requireRole = require('../middleware/requireRole');

async function detectCollections() {
  const collections = await db.listCollections();
  return collections.map((c) => c.id);
}

async function getSampleRequest(collectionName) {
  try {
    const snap = await db.collection(collectionName).orderBy('createdAt', 'desc').limit(1).get();
    if (snap.empty) return { collection: collectionName, countRecent: 0, first: null };
    const doc = snap.docs[0];
    const data = doc.data() || {};
    return {
      collection: collectionName,
      countRecent: snap.size,
      first: {
        id: doc.id,
        status: data.status || null,
        assignedTo: data.assignedTo || null,
        clientUid: data.clientUid || data.createdBy || null,
        createdAt: data.createdAt || null,
      },
    };
  } catch (err) {
    console.error('[debug] sample request read failed', err);
    return { collection: collectionName, countRecent: 0, first: null };
  }
}

async function getSampleEmployeeDoc() {
  try {
    const snap = await db.collection('employees').limit(1).get();
    if (snap.empty) return { exists: false, data: null };
    const doc = snap.docs[0];
    const data = doc.data() || {};
    return {
      exists: true,
      data: {
        displayName: data.displayName || data.name || null,
        photoUrl: data.photoUrl || data.photoURL || null,
        phone: data.phone || null,
        title: data.title || null,
      },
    };
  } catch (err) {
    console.error('[debug] sample employee read failed', err);
    return { exists: false, data: null };
  }
}

const ROUTES_SUMMARY = [
  'POST /api/client/requests',
  'GET /api/client/requests/active',
  'GET /api/client/requests',
  'POST /api/client/requests/:id/confirm (approve/ok aliases)',
  'POST /api/client/requests/:id/photo',
  'GET /api/employee/requests',
  'POST /api/employee/requests/:id/claim',
  'POST /api/employee/requests/:id/submit-proof',
  'POST /api/employee/requests/:id/mark-awaiting-client',
  'POST /api/boss/assign-request',
  'GET /api/boss/requests',
  'POST /api/boss/requests/:id/close',
  'PATCH /api/boss/requests/:id/force',
  'POST /api/boss/requests/:id/force-close',
  'GET /api/employee/profile/:employeeUid',
  'GET/POST /api/requests/:id/messages (if enabled)',
];

async function debugState(req, res) {
  const user = {
    uid: req.user?.uid || null,
    email: req.user?.email || null,
    role: req.user?.role || null,
    claims: req.user || null,
  };

  let collectionsDetected = [];
  try {
    collectionsDetected = await detectCollections();
  } catch (err) {
    console.error('[debug] listCollections failed', err);
  }

  const hasClientRequests = collectionsDetected.includes('clientRequests');
  const sampleRequests = hasClientRequests ? await getSampleRequest('clientRequests') : null;
  const sampleEmployeeDoc = await getSampleEmployeeDoc();

  return res.status(200).json({
    ok: true,
    user,
    collectionsDetected: {
      requestsCollectionsFound: collectionsDetected.filter((c) => c.toLowerCase().includes('request')),
      employeesCollectionExists: collectionsDetected.includes('employees'),
    },
    sampleRequests,
    sampleEmployeeDoc,
    routesSummary: ROUTES_SUMMARY,
  });
}

module.exports = {
  debugState,
  verifyFirebaseToken,
  requireRole,
};
