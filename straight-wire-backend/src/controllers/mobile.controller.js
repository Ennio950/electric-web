'use strict';

const {
  listClientRequests,
  listAvailableRequests,
  listEmployeeRequests,
  listAllRequestsForBoss,
  listEmergencyCalls,
  listPendingPayments,
  listBossReviewQueue,
} = require('../services/marketplace.service');
const { getCompanyConfig } = require('../services/companyConfig.service');
const {
  registerMobilePushToken,
  unregisterMobilePushToken,
} = require('../services/mobilePushTokens.service');
const {
  buildMobileBootstrapResponse,
  buildMobileClientHomeResponse,
  buildMobileEmployeeHomeResponse,
  buildMobileBossHomeResponse,
} = require('../utils/mobileContracts');

function sendError(res, status, error, message) {
  return res.status(status).json({ error, message });
}

function handleError(res, err) {
  const status = err && typeof err.status === 'number' ? err.status : 500;
  const error = err && typeof err.code === 'string' ? err.code : 'internal_error';
  const message = status >= 500 ? 'Internal Server Error' : err.message || 'Request failed.';
  return sendError(res, status, String(error).toLowerCase(), message);
}

function getMobileContext(req) {
  const user = req && req.user && typeof req.user === 'object' ? req.user : null;
  const uid = user && typeof user.uid === 'string' ? user.uid.trim() : '';
  const role = user && typeof user.role === 'string' ? user.role.trim() : '';

  if (!uid || (role !== 'client' && role !== 'employee' && role !== 'boss')) {
    return null;
  }

  return { user, uid, role };
}

async function getBootstrap(req, res) {
  const mobileUser = getMobileContext(req);
  if (!mobileUser) {
    return sendError(res, 403, 'forbidden', 'Insufficient permissions.');
  }

  try {
    const companyConfig = await getCompanyConfig();
    const payload = buildMobileBootstrapResponse({
      user: mobileUser.user,
      role: mobileUser.role,
      companyConfig,
    });
    return res.status(200).json(payload);
  } catch (err) {
    return handleError(res, err);
  }
}

async function getHome(req, res) {
  const mobileUser = getMobileContext(req);
  if (!mobileUser) {
    return sendError(res, 403, 'forbidden', 'Insufficient permissions.');
  }

  try {
    if (mobileUser.role === 'client') {
      const requests = await listClientRequests(mobileUser.uid, { limit: 200 });
      return res.status(200).json(buildMobileClientHomeResponse(requests));
    }

    if (mobileUser.role === 'employee') {
      const [availableRequests, myRequests, emergencyCalls] = await Promise.all([
        listAvailableRequests({ limit: 200 }),
        listEmployeeRequests(mobileUser.uid, { limit: 200 }),
        listEmergencyCalls(mobileUser.uid, mobileUser.role, { limit: 100 }),
      ]);

      return res.status(200).json(buildMobileEmployeeHomeResponse({
        employeeUid: mobileUser.uid,
        availableRequests,
        myRequests,
        emergencyCalls,
      }));
    }

    const [requests, emergencyCalls, pendingPayments, reviewQueue] = await Promise.all([
      listAllRequestsForBoss({ limit: 200 }),
      listEmergencyCalls(mobileUser.uid, mobileUser.role, { limit: 200, mode: 'all' }),
      listPendingPayments({ limit: 200 }),
      listBossReviewQueue({ limit: 200 }),
    ]);

    return res.status(200).json(buildMobileBossHomeResponse({
      requests,
      emergencyCalls,
      pendingPayments,
      reviewQueue,
    }));
  } catch (err) {
    return handleError(res, err);
  }
}

async function createPushToken(req, res) {
  const mobileUser = getMobileContext(req);
  if (!mobileUser) {
    return sendError(res, 403, 'forbidden', 'Insufficient permissions.');
  }

  try {
    const record = await registerMobilePushToken(mobileUser, req.body);
    return res.status(200).json({
      ok: true,
      data: {
        tokenId: record.tokenId,
        platform: record.platform,
        deviceId: record.deviceId,
        appVersion: record.appVersion,
      },
    });
  } catch (err) {
    return handleError(res, err);
  }
}

async function deletePushToken(req, res) {
  const mobileUser = getMobileContext(req);
  if (!mobileUser) {
    return sendError(res, 403, 'forbidden', 'Insufficient permissions.');
  }

  try {
    const result = await unregisterMobilePushToken(mobileUser, req.params.token);
    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = {
  getBootstrap,
  getHome,
  createPushToken,
  deletePushToken,
};
