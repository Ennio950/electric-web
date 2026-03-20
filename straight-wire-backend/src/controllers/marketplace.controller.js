'use strict';

/**
 * Marketplace Controller (Production)
 * 
 * Handles HTTP requests for marketplace operations.
 * Delegates business logic to marketplace.service.js
 */

const marketplaceService = require('../services/marketplace.service');
const estimatePdfService = require('../services/estimatePdf.service');
const { listUsersByRole } = require('../services/users.service');
const { auth, db } = require('../firebase');
const {
    notifyBossPaymentPendingReview,
    notifyEmployeeDepositRequired,
    notifyEmployeeProofRejected,
} = require('../services/operationalAlerts.service');
const { createLogger } = require('../utils/logger');
const {
    decorateMarketplaceRequest,
    decorateMarketplaceRequestList,
    decorateMarketplaceEmergencyCall,
    decorateMarketplaceEmergencyCallList,
    decorateBossReviewQueue,
    decorateEmployeeDirectory,
} = require('../utils/mobileContracts');

const logger = createLogger('marketplace.controller');

function sendError(res, status, error, message) {
    return res.status(status).json({ error, message });
}

function handleError(res, err) {
    const status = err && typeof err.status === 'number' ? err.status : 500;
    const error = err && typeof err.code === 'string' ? err.code : 'internal_error';

    const message = status >= 500 ? 'Internal Server Error' : err.message || 'Request failed.';
    const normalizedStatus = status === 409 ? 400 : status;

    return sendError(res, normalizedStatus, String(error).toLowerCase(), message);
}

function cleanString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function runDetached(label, task) {
    Promise.resolve()
        .then(task)
        .catch((error) => {
            logger.warn(`${label} alert failed:`, error?.message || error);
        });
}

function pickBestName(...values) {
    let emailFallback = '';
    for (const value of values) {
        const candidate = cleanString(value);
        if (!candidate) continue;
        if (candidate.includes('@')) {
            if (!emailFallback) emailFallback = candidate;
            continue;
        }
        return candidate;
    }
    return emailFallback;
}

function buildNotificationResponsePayload(record, notification) {
    return {
        record,
        notification,
    };
}

function normalizeEmployeeSummary(employee) {
    if (!employee || typeof employee !== 'object') return null;

    const name = pickBestName(
        employee.name,
        employee.displayName,
        employee.fullName,
        employee.nombre,
        employee.email
    );

    return {
        id: cleanString(employee.id || employee.uid),
        uid: cleanString(employee.uid || employee.id),
        name: name || null,
        email: cleanString(employee.email || employee.correo) || null,
        phone: cleanString(employee.phone || employee.telefono) || null,
        whatsappNumber: cleanString(employee.whatsappNumber || employee.whatsapp || employee.telefonoWhatsapp) || null,
    };
}

function serializeMarketplaceRequest(record) {
    return decorateMarketplaceRequest(record);
}

function serializeMarketplaceRequests(records) {
    return decorateMarketplaceRequestList(records);
}

function serializeEmergencyCall(record) {
    return decorateMarketplaceEmergencyCall(record);
}

function serializeEmergencyCalls(records) {
    return decorateMarketplaceEmergencyCallList(records);
}

function serializeReviewQueue(records) {
    return decorateBossReviewQueue(records);
}

function serializeEmployeeDirectory(records) {
    return decorateEmployeeDirectory(
        Array.isArray(records) ? records.map(normalizeEmployeeSummary) : [],
    );
}

async function sendBossPaymentReminderForRequest(request, actorUid) {
    if (cleanString(request?.assignedEmployeeId) !== cleanString(actorUid)) {
        const error = new Error('Solo el tecnico asignado puede notificar al jefe.');
        error.status = 403;
        error.code = 'forbidden';
        throw error;
    }

    if (cleanString(request?.status) !== 'PAGO_PENDIENTE_REVISION') {
        const error = new Error('La solicitud debe estar en revision de pago antes de notificar al jefe.');
        error.status = 400;
        error.code = 'invalid_state';
        throw error;
    }

    if (!cleanString(request?.paymentProofUrl)) {
        const error = new Error('Todavia no hay comprobante cargado para esta solicitud.');
        error.status = 400;
        error.code = 'invalid_state';
        throw error;
    }

    const notification = await notifyBossPaymentPendingReview({
        sourceType: 'request',
        recordId: request.id,
        employeeUid: request.assignedEmployeeId,
        employeeName: request.employeeName || request.employeeEmail || '',
        clientName: request.clientNickname || request.clientEmail || '',
        amount: request.finalAmount,
        address: request.address,
    });

    if (!notification || notification.ok === false) {
        const error = new Error(notification?.message || 'No se pudo notificar al jefe por WhatsApp.');
        error.status = 502;
        error.code = 'notification_failed';
        throw error;
    }

    return notification;
}

async function sendBossPaymentReminderForEmergency(call, actorUid) {
    if (cleanString(call?.assignedEmployeeId) !== cleanString(actorUid)) {
        const error = new Error('Solo el tecnico asignado puede notificar al jefe.');
        error.status = 403;
        error.code = 'forbidden';
        throw error;
    }

    if (cleanString(call?.status).toLowerCase() !== 'payment_pending_review') {
        const error = new Error('La emergencia debe estar en revision de pago antes de notificar al jefe.');
        error.status = 400;
        error.code = 'invalid_state';
        throw error;
    }

    if (!cleanString(call?.paymentProofUrl)) {
        const error = new Error('Todavia no hay comprobante cargado para esta emergencia.');
        error.status = 400;
        error.code = 'invalid_state';
        throw error;
    }

    const notification = await notifyBossPaymentPendingReview({
        sourceType: 'emergency',
        recordId: call.id,
        employeeUid: call.assignedEmployeeId,
        employeeName: call.assignedEmployeeName || call.assignedEmployeeEmail || '',
        clientName: call.clientName || call.clientEmail || '',
        amount: call.finalAmount ?? call.quotedAmount,
        address: call.location || call.address || '',
    });

    if (!notification || notification.ok === false) {
        const error = new Error(notification?.message || 'No se pudo notificar al jefe por WhatsApp.');
        error.status = 502;
        error.code = 'notification_failed';
        throw error;
    }

    return notification;
}

async function resolveEmployeeIdentity(uid, fallback = {}) {
    const employeeUid = cleanString(uid);
    const fallbackName = cleanString(fallback.name);
    const fallbackEmail = cleanString(fallback.email);

    if (!employeeUid) {
        return {
            name: pickBestName(fallbackName, fallbackEmail) || null,
            email: fallbackEmail || null,
        };
    }

    let profileName = '';
    let profileEmail = '';

    try {
        const snap = await db.collection('users').doc(employeeUid).get();
        if (snap.exists) {
            const data = snap.data() || {};
            profileName = pickBestName(data.name, data.displayName, data.nombre, data.fullName);
            profileEmail = cleanString(data.email || data.correo);
        }
    } catch (err) {
        console.warn('[marketplace] Could not read users profile', employeeUid, err?.message || err);
    }

    if (!profileName || !profileEmail) {
        try {
            const user = await auth.getUser(employeeUid);
            profileName = pickBestName(profileName, user.displayName, user.email);
            profileEmail = cleanString(profileEmail || user.email);
        } catch (err) {
            // Ignore auth lookup failures and keep fallbacks.
        }
    }

    return {
        name: pickBestName(profileName, fallbackName, fallbackEmail) || null,
        email: cleanString(profileEmail || fallbackEmail) || null,
    };
}

async function buildEmployeeIdentityMap(requests = []) {
    const ids = Array.from(
        new Set(
            (Array.isArray(requests) ? requests : [])
                .map((request) => cleanString(request?.assignedEmployeeId))
                .filter(Boolean)
        )
    );

    const identityMap = new Map();
    if (!ids.length) return identityMap;

    try {
        const refs = ids.map((uid) => db.collection('users').doc(uid));
        const snaps = await db.getAll(...refs);
        snaps.forEach((snap, index) => {
            const uid = ids[index];
            const data = snap.exists ? (snap.data() || {}) : {};
            identityMap.set(uid, {
                name: pickBestName(data.name, data.displayName, data.nombre, data.fullName),
                email: cleanString(data.email || data.correo),
            });
        });
    } catch (err) {
        console.warn('[marketplace] Batch users lookup failed', err?.message || err);
    }

    await Promise.all(ids.map(async (uid) => {
        const current = identityMap.get(uid) || {};
        if (cleanString(current.name) && cleanString(current.email)) return;
        try {
            const user = await auth.getUser(uid);
            identityMap.set(uid, {
                name: pickBestName(current.name, user.displayName, user.email),
                email: cleanString(current.email || user.email),
            });
        } catch (_) {
            // Ignore lookup errors for missing users.
        }
    }));

    return identityMap;
}

function applyEmployeeIdentity(request, identityMap) {
    if (!request || typeof request !== 'object') return request;

    const uid = cleanString(request.assignedEmployeeId);
    const currentName = cleanString(request.employeeName);
    const currentEmail = cleanString(request.employeeEmail);

    if (!uid) {
        const fallbackName = pickBestName(currentName, currentEmail);
        return fallbackName
            ? { ...request, employeeName: fallbackName, employeeEmail: currentEmail || null }
            : request;
    }

    const identity = identityMap.get(uid) || {};
    const resolvedName = pickBestName(currentName, identity.name, currentEmail, identity.email);
    const resolvedEmail = cleanString(currentEmail || identity.email);

    if (!resolvedName && !resolvedEmail) return request;
    return {
        ...request,
        employeeName: resolvedName || null,
        employeeEmail: resolvedEmail || null,
    };
}

async function hydrateRequestsEmployeeIdentity(requests = []) {
    if (!Array.isArray(requests) || requests.length === 0) return Array.isArray(requests) ? requests : [];
    const identityMap = await buildEmployeeIdentityMap(requests);
    return requests.map((request) => applyEmployeeIdentity(request, identityMap));
}

async function hydrateRequestEmployeeIdentity(request) {
    if (!request || typeof request !== 'object') return request;
    const hydrated = await hydrateRequestsEmployeeIdentity([request]);
    return hydrated[0] || request;
}

// ============================================================
// Client Endpoints
// ============================================================

/**
 * POST /api/marketplace/requests
 * Creates a new service request.
 */
async function createRequest(req, res, next) {
    try {
        const clientUid = req.user.uid;
        const clientInfo = {
            email: req.user.email || null,
            nickname: req.user.nickname || req.body.nickname || null,
            isGuest: req.user.isGuest || false,
        };

        const request = await marketplaceService.createRequest(
            clientUid,
            req.body,
            clientInfo
        );

        return res.status(201).json({
            ok: true,
            data: serializeMarketplaceRequest(request),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * GET /api/marketplace/requests
 * Lists requests for the current client.
 */
async function listClientRequests(req, res, next) {
    try {
        const clientUid = req.user.uid;
        const requests = await marketplaceService.listClientRequests(clientUid, {
            limit: req.query.limit,
        });
        const hydratedRequests = await hydrateRequestsEmployeeIdentity(requests);

        return res.status(200).json({
            ok: true,
            data: serializeMarketplaceRequests(hydratedRequests),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * GET /api/marketplace/emergency-calls
 * Lists emergency calls according to current role.
 */
async function listEmergencyCalls(req, res, next) {
    try {
        const calls = await marketplaceService.listEmergencyCalls(req.user.uid, req.user.role, {
            limit: req.query.limit,
            status: req.query.status,
            mode: req.query.mode,
        });

        return res.status(200).json({
            ok: true,
            data: serializeEmergencyCalls(calls),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * GET /api/marketplace/emergency-calls/:id
 * Gets a single emergency call detail.
 */
async function getEmergencyCall(req, res, next) {
    try {
        const call = await marketplaceService.getEmergencyCall(req.params.id);

        const isOwner = call.clientId === req.user.uid;
        const isAssigned = call.assignedEmployeeId === req.user.uid;
        const isBoss = req.user.role === 'boss';
        const isVisiblePendingEmergency = req.user.role === 'employee' && call.status === 'pending';

        if (!isOwner && !isAssigned && !isBoss && !isVisiblePendingEmergency) {
            return res.status(403).json({
                ok: false,
                error: 'forbidden',
                message: 'No tienes acceso a esta emergencia.',
            });
        }

        return res.status(200).json({
            ok: true,
            data: serializeEmergencyCall(call),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/emergency-calls
 * Client creates a new emergency call.
 */
async function createEmergencyCall(req, res, next) {
    try {
        const clientUid = req.user.uid;
        const call = await marketplaceService.createEmergencyCall(
            clientUid,
            req.body,
            {
                email: req.user.email || null,
            }
        );

        return res.status(201).json({
            ok: true,
            data: serializeEmergencyCall(call),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * GET /api/marketplace/requests/available
 * Lists EN_ESPERA requests for employees.
 */
async function listAvailableRequests(req, res, next) {
    try {
        const requests = await marketplaceService.listAvailableRequests({
            limit: req.query.limit,
        });
        const hydratedRequests = await hydrateRequestsEmployeeIdentity(requests);

        return res.status(200).json({
            ok: true,
            data: serializeMarketplaceRequests(hydratedRequests),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * GET /api/marketplace/requests/:id
 * Gets a single request detail.
 */
async function getRequest(req, res, next) {
    try {
        const rawRequest = await marketplaceService.getRequest(req.params.id);

        // Authorization: must be client, assigned employee, or boss
        const isOwner = rawRequest.clientId === req.user.uid;
        const isAssigned = rawRequest.assignedEmployeeId === req.user.uid;
        const isBoss = req.user.role === 'boss';

        if (!isOwner && !isAssigned && !isBoss) {
            return res.status(403).json({
                ok: false,
                error: 'forbidden',
                message: 'No tienes acceso a esta solicitud.',
            });
        }
        const request = await hydrateRequestEmployeeIdentity(rawRequest);

        return res.status(200).json({
            ok: true,
            data: serializeMarketplaceRequest(request),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * DELETE /api/marketplace/requests/:id
 * Cancels a request (client only, EN_ESPERA status).
 */
async function cancelRequest(req, res, next) {
    try {
        const clientUid = req.user.uid;
        const rawRequest = await marketplaceService.cancelRequest(req.params.id, clientUid);
        const request = await hydrateRequestEmployeeIdentity(rawRequest);

        return res.status(200).json({
            ok: true,
            data: request,
        });
    } catch (err) {
        return next(err);
    }
}

// ============================================================
// Employee Endpoints
// ============================================================

/**
 * GET /api/marketplace/employee/my-requests
 * Lists requests assigned to current employee.
 */
async function listEmployeeRequests(req, res, next) {
    try {
        const employeeUid = req.user.uid;
        const requests = await marketplaceService.listEmployeeRequests(employeeUid, {
            limit: req.query.limit,
        });
        const hydratedRequests = await hydrateRequestsEmployeeIdentity(requests);

        return res.status(200).json({
            ok: true,
            data: serializeMarketplaceRequests(hydratedRequests),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * GET /api/marketplace/employee/active-job
 * Gets the current active job for employee.
 */
async function getActiveJob(req, res, next) {
    try {
        const employeeUid = req.user.uid;
        const rawJob = await marketplaceService.getActiveJobForEmployee(employeeUid);
        const job = await hydrateRequestEmployeeIdentity(rawJob);

        return res.status(200).json({
            ok: true,
            data: serializeMarketplaceRequest(job),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/requests/:id/claim
 * Employee claims a request: EN_ESPERA → ASIGNADO
 */
async function claimRequest(req, res, next) {
    try {
        const employeeUid = req.user.uid;
        const employeeInfo = await resolveEmployeeIdentity(employeeUid, {
            email: req.user.email || null,
            name: req.user.name || req.user.displayName || null,
        });

        const rawRequest = await marketplaceService.claimRequest(
            req.params.id,
            employeeUid,
            employeeInfo
        );
        const request = await hydrateRequestEmployeeIdentity(rawRequest);

        // Notify via Socket.IO
        const io = req.app.get('io');
        if (io) {
            io.to('employees').emit('request:claimed', { requestId: req.params.id });
        }

        return res.status(200).json({
            ok: true,
            data: request,
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/requests/:id/release
 * Employee releases claim: ASIGNADO → EN_ESPERA
 */
async function releaseClaim(req, res, next) {
    try {
        const employeeUid = req.user.uid;
        const rawRequest = await marketplaceService.releaseClaim(req.params.id, employeeUid);
        const request = await hydrateRequestEmployeeIdentity(rawRequest);

        // Notify via Socket.IO
        const io = req.app.get('io');
        if (io) {
            io.to('employees').emit('request:released', { requestId: req.params.id });
        }

        return res.status(200).json({
            ok: true,
            data: request,
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/requests/:id/proposal
 * Employee sends proposal: ASIGNADO → NEGOCIANDO
 */
async function sendProposal(req, res, next) {
    try {
        const employeeUid = req.user.uid;
        const employeeIdentity = await resolveEmployeeIdentity(employeeUid, {
            email: req.user?.email,
            name: req.user?.name || req.user?.displayName,
        });
        const incomingCreatedBy = req.body && typeof req.body.createdBy === 'object' ? req.body.createdBy : {};
        const creatorUid = typeof req.user?.uid === 'string' ? req.user.uid.trim() : '';
        const creatorEmail = cleanString(employeeIdentity.email)
            || (typeof req.user?.email === 'string' ? req.user.email.trim() : '');
        const creatorName = cleanString(employeeIdentity.name)
            || (typeof req.user?.name === 'string'
                ? req.user.name.trim()
                : (typeof req.user?.displayName === 'string'
                    ? req.user.displayName.trim()
                    : (typeof incomingCreatedBy.name === 'string' ? incomingCreatedBy.name.trim() : '')));
        const creatorSource = creatorUid || creatorEmail || creatorName;
        const creatorToken = creatorSource.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const creatorTail = creatorToken ? creatorToken.slice(-6).padStart(6, '0') : '000000';
        const creatorCode = `EMP-${creatorTail}`;
        const proposalPayload = {
            ...(req.body && typeof req.body === 'object' ? req.body : {}),
            quoteCreatorId: creatorCode,
            createdBy: {
                uid: creatorUid || null,
                email: creatorEmail || (typeof incomingCreatedBy.email === 'string' ? incomingCreatedBy.email.trim() : null),
                name: creatorName || null,
                employeeCode: creatorCode
            }
        };

        const rawRequest = await marketplaceService.sendProposal(
            req.params.id,
            employeeUid,
            proposalPayload
        );
        const request = await hydrateRequestEmployeeIdentity(rawRequest);

        return res.status(200).json({
            ok: true,
            data: request,
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/requests/:id/accept-proposal
 * Client accepts proposal: NEGOCIANDO → EN_PROCESO
 */
async function acceptProposal(req, res, next) {
    try {
        const clientUid = req.user.uid;
        const rawRequest = await marketplaceService.acceptProposal(req.params.id, clientUid);
        const request = await hydrateRequestEmployeeIdentity(rawRequest);

        return res.status(200).json({
            ok: true,
            data: request,
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/requests/:id/reject-proposal
 * Client rejects proposal: NEGOCIANDO → EN_ESPERA
 */
async function rejectProposal(req, res, next) {
    try {
        const clientUid = req.user.uid;
        const rawRequest = await marketplaceService.rejectProposal(req.params.id, clientUid);
        const request = await hydrateRequestEmployeeIdentity(rawRequest);

        // Notify via Socket.IO
        const io = req.app.get('io');
        if (io) {
            io.to('employees').emit('request:released', { requestId: req.params.id });
        }

        return res.status(200).json({
            ok: true,
            data: request,
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/requests/:id/finish
 * Employee marks finished: EN_PROCESO → ESPERANDO_CIERRE_CLIENTE
 */
async function markFinished(req, res, next) {
    try {
        const employeeUid = req.user.uid;
        const rawRequest = await marketplaceService.markFinished(req.params.id, employeeUid);
        const request = await hydrateRequestEmployeeIdentity(rawRequest);

        return res.status(200).json({
            ok: true,
            data: request,
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/requests/:id/close
 * Client closes: ESPERANDO_CIERRE_CLIENTE → ESPERANDO_COMPROBANTE_PAGO
 */
async function clientClose(req, res, next) {
    try {
        const clientUid = req.user.uid;
        const rawRequest = await marketplaceService.clientClose(
            req.params.id,
            clientUid,
            req.body
        );
        const request = await hydrateRequestEmployeeIdentity(rawRequest);

        runDetached('employee deposit required', () => notifyEmployeeDepositRequired({
            sourceType: 'request',
            recordId: request.id,
            employeeUid: request.assignedEmployeeId,
            fallbackRecipient: {
                phone: request.employeePhone,
                whatsappNumber: request.employeeWhatsappNumber,
            },
            clientName: request.clientNickname || request.clientEmail || '',
            amount: request.finalAmount,
            address: request.address,
        }));

        return res.status(200).json({
            ok: true,
            data: serializeMarketplaceRequest(request),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/requests/:id/payment-proof
 * Submit payment proof: ESPERANDO_COMPROBANTE_PAGO → PAGO_PENDIENTE_REVISION
 */
async function submitPaymentProof(req, res, next) {
    try {
        const actorUid = req.user.uid;
        const actorRole = req.user.role;
        const proofUrl = req.body.proofUrl;

        logger.debug('submitPaymentProof - uid:', actorUid, 'role:', actorRole, 'requestId:', req.params.id);

        const rawRequest = await marketplaceService.submitPaymentProof(
            req.params.id,
            actorUid,
            proofUrl
        );
        const request = await hydrateRequestEmployeeIdentity(rawRequest);

        logger.info('submitPaymentProof - success, new status:', request.status);

        runDetached('boss payment pending review', () => notifyBossPaymentPendingReview({
            sourceType: 'request',
            recordId: request.id,
            employeeUid: request.assignedEmployeeId,
            employeeName: request.employeeName || request.employeeEmail || '',
            clientName: request.clientNickname || request.clientEmail || '',
            amount: request.finalAmount,
            address: request.address,
        }));

        return res.status(200).json({
            ok: true,
            data: serializeMarketplaceRequest(request),
        });
    } catch (err) {
        return next(err);
    }
}

// ============================================================
// Boss Endpoints
// ============================================================

/**
 * POST /api/marketplace/requests/:id/approve-payment
 * Boss approves payment: PAGO_PENDIENTE_REVISION → COMPLETADO
 */
async function approvePayment(req, res, next) {
    try {
        const bossUid = req.user.uid;
        const bossRole = req.user.role;

        logger.debug('approvePayment - uid:', bossUid, 'role:', bossRole, 'requestId:', req.params.id);

        const rawRequest = await marketplaceService.approvePayment(req.params.id, bossUid);
        const request = await hydrateRequestEmployeeIdentity(rawRequest);

        logger.info('approvePayment - success, new status:', request.status);

        return res.status(200).json({
            ok: true,
            data: request,
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * GET /api/marketplace/boss/requests
 * Boss lists all requests.
 */
async function listAllRequests(req, res, next) {
    try {
        const requests = await marketplaceService.listAllRequestsForBoss({
            limit: req.query.limit,
            status: req.query.status,
        });
        const hydratedRequests = await hydrateRequestsEmployeeIdentity(requests);

        return res.status(200).json({
            ok: true,
            data: serializeMarketplaceRequests(hydratedRequests),
        });
    } catch (err) {
        return next(err);
    }
}

async function listBossEmployees(req, res, next) {
    try {
        const employees = await listUsersByRole('employee', {
            limit: req.query.limit,
        });

        return res.status(200).json({
            ok: true,
            data: serializeEmployeeDirectory(employees),
        });
    } catch (err) {
        return next(err);
    }
}

async function assignRequestToEmployee(req, res, next) {
    try {
        const employeeUid = cleanString(req.body?.employeeId);
        if (!employeeUid) {
            return res.status(400).json({
                ok: false,
                error: 'invalid_payload',
                message: 'employeeId es requerido.',
            });
        }

        const employeeInfo = await resolveEmployeeIdentity(employeeUid, {
            email: req.body?.employeeEmail || null,
            name: req.body?.employeeName || null,
        });

        const rawRequest = await marketplaceService.assignRequestByBoss(
            req.params.id,
            employeeUid,
            employeeInfo
        );
        const request = await hydrateRequestEmployeeIdentity(rawRequest);

        return res.status(200).json({
            ok: true,
            data: serializeMarketplaceRequest(request),
        });
    } catch (err) {
        return next(err);
    }
}

async function assignEmergencyCallToEmployee(req, res, next) {
    try {
        const employeeUid = cleanString(req.body?.employeeId);
        if (!employeeUid) {
            return res.status(400).json({
                ok: false,
                error: 'invalid_payload',
                message: 'employeeId es requerido.',
            });
        }

        const employeeInfo = await resolveEmployeeIdentity(employeeUid, {
            email: req.body?.employeeEmail || null,
            name: req.body?.employeeName || null,
        });

        const call = await marketplaceService.acceptEmergencyCall(
            req.params.id,
            employeeUid,
            employeeInfo,
            'employee'
        );

        return res.status(200).json({
            ok: true,
            data: serializeEmergencyCall(call),
        });
    } catch (err) {
        return next(err);
    }
}

async function unassignRequestByBoss(req, res, next) {
    try {
        const rawRequest = await marketplaceService.releaseRequestByBoss(req.params.id);
        const request = await hydrateRequestEmployeeIdentity(rawRequest);

        return res.status(200).json({
            ok: true,
            data: serializeMarketplaceRequest(request),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/requests/:id/notify-boss-payment
 * Assigned employee re-sends payment review WhatsApp to boss.
 */
async function notifyBossPaymentReview(req, res, next) {
    try {
        const actorUid = req.user.uid;
        const rawRequest = await marketplaceService.getRequest(req.params.id);
        const request = await hydrateRequestEmployeeIdentity(rawRequest);
        const notification = await sendBossPaymentReminderForRequest(request, actorUid);

        return res.status(200).json({
            ok: true,
            data: buildNotificationResponsePayload(serializeMarketplaceRequest(request), notification),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/requests/:id/reject-payment
 * Boss rejects payment proof and sends request back for a new proof.
 */
async function rejectPayment(req, res, next) {
    try {
        const bossUid = req.user.uid;
        const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';

        logger.debug('rejectPayment - uid:', bossUid, 'requestId:', req.params.id);

        const rawRequest = await marketplaceService.rejectPayment(req.params.id, bossUid, reason);
        const request = await hydrateRequestEmployeeIdentity(rawRequest);

        logger.info('rejectPayment - success, new status:', request.status);

        runDetached('employee proof rejected', () => notifyEmployeeProofRejected({
            sourceType: 'request',
            recordId: request.id,
            employeeUid: request.assignedEmployeeId,
            fallbackRecipient: {
                phone: request.employeePhone,
                whatsappNumber: request.employeeWhatsappNumber,
            },
            reason: request.paymentRejectionReason || reason,
            address: request.address,
        }));

        return res.status(200).json({
            ok: true,
            data: serializeMarketplaceRequest(request),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/emergency-calls/:id/accept
 * Employee or boss accepts an emergency.
 */
async function acceptEmergencyCall(req, res, next) {
    try {
        const actorUid = req.user.uid;
        const actorInfo = await resolveEmployeeIdentity(actorUid, {
            email: req.user.email || null,
            name: req.user.name || req.user.displayName || null,
        });

        const call = await marketplaceService.acceptEmergencyCall(
            req.params.id,
            actorUid,
            actorInfo,
            req.user.role
        );

        return res.status(200).json({
            ok: true,
            data: serializeEmergencyCall(call),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/emergency-calls/:id/resolve
 * Assigned employee or boss resolves an emergency.
 */
async function resolveEmergencyCall(req, res, next) {
    try {
        const actorUid = req.user.uid;
        const actorInfo = await resolveEmployeeIdentity(actorUid, {
            email: req.user.email || null,
            name: req.user.name || req.user.displayName || null,
        });

        const call = await marketplaceService.resolveEmergencyCall(
            req.params.id,
            actorUid,
            req.user.role,
            actorInfo,
            req.body
        );

        return res.status(200).json({
            ok: true,
            data: serializeEmergencyCall(call),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/emergency-calls/:id/close
 * Client confirms amount paid, uploads final photo and rating.
 */
async function clientCloseEmergencyCall(req, res, next) {
    try {
        const call = await marketplaceService.clientCloseEmergencyCall(
            req.params.id,
            req.user.uid,
            req.body
        );

        runDetached('employee emergency deposit required', () => notifyEmployeeDepositRequired({
            sourceType: 'emergency',
            recordId: call.id,
            employeeUid: call.assignedEmployeeId,
            fallbackRecipient: {
                phone: call.assignedEmployeePhone,
                whatsappNumber: call.assignedEmployeeWhatsappNumber,
            },
            clientName: call.clientName || call.clientEmail || '',
            amount: call.finalAmount ?? call.quotedAmount,
            address: call.location || call.address || '',
        }));

        return res.status(200).json({
            ok: true,
            data: serializeEmergencyCall(call),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/emergency-calls/:id/payment-proof
 * Assigned employee submits payment proof for boss review.
 */
async function submitEmergencyPaymentProof(req, res, next) {
    try {
        const call = await marketplaceService.submitEmergencyPaymentProof(
            req.params.id,
            req.user.uid,
            req.body.proofUrl
        );

        runDetached('boss emergency payment pending review', () => notifyBossPaymentPendingReview({
            sourceType: 'emergency',
            recordId: call.id,
            employeeUid: call.assignedEmployeeId,
            employeeName: call.assignedEmployeeName || call.assignedEmployeeEmail || '',
            clientName: call.clientName || call.clientEmail || '',
            amount: call.finalAmount ?? call.quotedAmount,
            address: call.location || call.address || '',
        }));

        return res.status(200).json({
            ok: true,
            data: serializeEmergencyCall(call),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/emergency-calls/:id/notify-boss-payment
 * Assigned employee re-sends payment review WhatsApp to boss.
 */
async function notifyBossEmergencyPaymentReview(req, res, next) {
    try {
        const actorUid = req.user.uid;
        const call = await marketplaceService.getEmergencyCall(req.params.id);
        const notification = await sendBossPaymentReminderForEmergency(call, actorUid);

        return res.status(200).json({
            ok: true,
            data: buildNotificationResponsePayload(serializeEmergencyCall(call), notification),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/emergency-calls/:id/approve-payment
 * Boss approves emergency payment and completes the job.
 */
async function approveEmergencyPayment(req, res, next) {
    try {
        const call = await marketplaceService.approveEmergencyPayment(
            req.params.id,
            req.user.uid
        );

        return res.status(200).json({
            ok: true,
            data: serializeEmergencyCall(call),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/emergency-calls/:id/reject-payment
 * Boss rejects emergency payment proof and sends it back for resubmission.
 */
async function rejectEmergencyPayment(req, res, next) {
    try {
        const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
        const call = await marketplaceService.rejectEmergencyPayment(
            req.params.id,
            req.user.uid,
            reason
        );

        runDetached('employee emergency proof rejected', () => notifyEmployeeProofRejected({
            sourceType: 'emergency',
            recordId: call.id,
            employeeUid: call.assignedEmployeeId,
            fallbackRecipient: {
                phone: call.assignedEmployeePhone,
                whatsappNumber: call.assignedEmployeeWhatsappNumber,
            },
            reason: call.paymentRejectionReason || reason,
            address: call.location || call.address || '',
        }));

        return res.status(200).json({
            ok: true,
            data: serializeEmergencyCall(call),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * DELETE /api/marketplace/emergency-calls/:id
 * Staff removes an emergency call.
 */
async function deleteEmergencyCall(req, res, next) {
    try {
        const result = await marketplaceService.deleteEmergencyCall(req.params.id, {
            uid: cleanString(req.user?.uid),
            role: cleanString(req.user?.role),
        });
        return res.status(200).json({
            ok: true,
            data: result,
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/emergency-calls/:id/location
 * Updates live location for client or assigned employee.
 */
async function updateEmergencyLocation(req, res, next) {
    try {
        const call = await marketplaceService.updateEmergencyLocation(
            req.params.id,
            req.user.uid,
            req.user.role,
            req.body
        );

        return res.status(200).json({
            ok: true,
            data: serializeEmergencyCall(call),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * GET /api/marketplace/boss/payments/pending
 * Boss lists pending payment approvals.
 */
async function listPendingPayments(req, res, next) {
    try {
        const requests = await marketplaceService.listPendingPayments({
            limit: req.query.limit,
        });
        const hydratedRequests = await hydrateRequestsEmployeeIdentity(requests);

        return res.status(200).json({
            ok: true,
            data: serializeMarketplaceRequests(hydratedRequests),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * GET /api/marketplace/boss/review-queue
 * Boss unified review queue (requests + emergency calls).
 */
async function listBossReviewQueue(req, res, next) {
    try {
        const rows = await marketplaceService.listBossReviewQueue({
            limit: req.query.limit,
        });

        return res.status(200).json({
            ok: true,
            data: serializeReviewQueue(rows),
        });
    } catch (err) {
        return next(err);
    }
}

// ============================================================
// Chat Endpoints
// ============================================================

/**
 * GET /api/marketplace/requests/:id/chat
 * List chat messages for a request.
 */
async function listChatMessages(req, res, next) {
    try {
        const messages = await marketplaceService.listChatMessages(
            req.params.id,
            req.user.uid,
            req.user.role,
            { limit: req.query.limit }
        );

        return res.status(200).json({
            ok: true,
            data: messages,
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/requests/:id/chat
 * Send a chat message.
 */
async function sendChatMessageHandler(req, res, next) {
    try {
        const text = req.body.text || req.body.message || '';
        let senderName = req.user.name || req.user.displayName || req.user.email || '';
        if (req.user.role === 'employee') {
            const employeeIdentity = await resolveEmployeeIdentity(req.user.uid, {
                email: req.user.email,
                name: req.user.name || req.user.displayName,
            });
            senderName = employeeIdentity.name || senderName;
        }
        const isInternal = !!req.body.isInternal;

        const attachments = req.body.attachments || [];

        const message = await marketplaceService.sendChatMessage(
            req.params.id,
            req.user.uid,
            req.user.role,
            text,
            senderName,
            isInternal,
            attachments
        );

        return res.status(201).json({
            ok: true,
            data: message,
        });
    } catch (err) {
        return next(err);
    }
}

// ============================================================
// Uploads
// ============================================================
// ============================================================
// Uploads
// ============================================================
const cloudinary = require('cloudinary').v2;

async function renderEstimatePdf(req, res) {
    try {
        const payload = req.body && typeof req.body === 'object' ? { ...req.body } : {};
        const incomingCreatedBy = payload.createdBy && typeof payload.createdBy === 'object' ? payload.createdBy : {};
        const creatorUid = typeof req.user?.uid === 'string' ? req.user.uid.trim() : '';
        let employeeIdentity = null;
        if (req.user?.role === 'employee' && creatorUid) {
            employeeIdentity = await resolveEmployeeIdentity(creatorUid, {
                email: req.user?.email,
                name: req.user?.name || req.user?.displayName,
            });
        }
        const creatorEmail = cleanString(employeeIdentity?.email)
            || (typeof req.user?.email === 'string' ? req.user.email.trim() : '');
        const creatorName = cleanString(employeeIdentity?.name)
            || (typeof req.user?.name === 'string'
                ? req.user.name.trim()
                : (typeof req.user?.displayName === 'string'
                    ? req.user.displayName.trim()
                    : (typeof incomingCreatedBy.name === 'string' ? incomingCreatedBy.name.trim() : '')));
        const creatorSource = creatorUid || creatorEmail || creatorName;
        const creatorToken = creatorSource.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const creatorTail = creatorToken ? creatorToken.slice(-6).padStart(6, '0') : '000000';
        const creatorCode = `EMP-${creatorTail}`;

        payload.createdBy = {
            uid: creatorUid || null,
            email: creatorEmail || (typeof incomingCreatedBy.email === 'string' ? incomingCreatedBy.email.trim() : null),
            name: creatorName || null,
            employeeCode: creatorCode
        };
        payload.quoteCreatorId = creatorCode;

        const quoteNumber = typeof payload.quoteNumber === 'string' ? payload.quoteNumber.trim().toUpperCase() : '';
        if (!/^QU\d{6,}$/.test(quoteNumber)) {
            payload.quoteNumber = await marketplaceService.allocateNextQuoteNumber();
        }
        const pdfBuffer = await estimatePdfService.renderEstimatePdf(payload);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="estimate_${Date.now()}.pdf"`);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        return res.status(200).send(pdfBuffer);
    } catch (err) {
        logger.error('renderEstimatePdf error:', err);
        const message = /Cannot find module 'puppeteer'/.test(String(err?.message || ''))
            ? 'PDF engine not installed. Run npm install in backend.'
            : (err?.message || 'Failed to generate PDF.');
        return res.status(500).json({
            ok: false,
            error: 'pdf_render_failed',
            message
        });
    }
}

/**
 * GET /api/marketplace/emergency-calls/:id/chat
 * List chat messages for an emergency call.
 */
async function listEmergencyChatMessages(req, res, next) {
    try {
        const messages = await marketplaceService.listEmergencyChatMessages(
            req.params.id,
            req.user.uid,
            req.user.role,
            { limit: req.query.limit }
        );

        return res.status(200).json({
            ok: true,
            data: messages,
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/emergency-calls/:id/chat
 * Send a chat message for an emergency call.
 */
async function sendEmergencyChatMessageHandler(req, res, next) {
    try {
        let senderName = req.user.name || req.user.displayName || req.user.email || '';
        if (req.user.role === 'employee' || req.user.role === 'boss') {
            const employeeIdentity = await resolveEmployeeIdentity(req.user.uid, {
                email: req.user.email,
                name: req.user.name || req.user.displayName,
            });
            senderName = employeeIdentity.name || senderName;
        }

        const message = await marketplaceService.sendEmergencyChatMessage(
            req.params.id,
            req.user.uid,
            req.user.role,
            req.body.text || req.body.message || '',
            senderName,
            req.body.attachments || []
        );

        return res.status(201).json({
            ok: true,
            data: message,
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /api/marketplace/quote-number/next
 * Allocates the next sequential quote number (QU000001, QU000002, ...).
 */
async function getNextQuoteNumber(req, res, next) {
    try {
        const quoteNumber = await marketplaceService.allocateNextQuoteNumber();
        return res.status(200).json({
            ok: true,
            data: { quoteNumber }
        });
    } catch (err) {
        return next(err);
    }
}

async function uploadEstimate(req, res, next) {
    if (!req.file) {
        return sendError(res, 400, 'invalid_input', 'No file uploaded.');
    }

    try {
        logger.debug(`Uploading PDF (Private). Size: ${req.file.size} bytes`);

        // Stream upload to Cloudinary (Private Mode)
        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    resource_type: 'raw',       // PDF as raw file
                    type: 'private',            // Secure delivery without auth_token
                    folder: 'estimates',
                    public_id: `estimate_${Date.now()}.pdf`,
                    use_filename: true,
                    unique_filename: false,
                    overwrite: true
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            stream.end(req.file.buffer);
        });

        logger.info(`Upload success. Public ID: ${result.public_id}`);

        // Return METADATA only (no public URL)
        // Frontend will store this in the request document.
        return res.status(200).json({
            ok: true,
            data: {
                public_id: result.public_id,
                resource_type: result.resource_type,
                type: result.type,
                format: result.format,
                version: result.version,
                secure_url: result.secure_url // Still returned but implies auth needed
            }
        });
    } catch (err) {
        logger.error('Upload error:', err);
        return handleError(res, err);
    }
}

/**
 * GET /api/marketplace/requests/:id/estimate-url
 * Generates a temporary signed URL for viewing the estimate PDF.
 */
async function getEstimateUrl(req, res, next) {
    try {
        const requestId = req.params.id;
        const uid = req.user.uid;
        const role = req.user.role;

        // 1. Get Request Metadata from DB to verify ownership & file existence
        const request = await marketplaceService.getRequest(requestId);

        // 2. Authorization (Client Owner or Boss)
        // Employees might need access too if they are assigned? User said "Denegar a employee salvo reglas explícitas".
        // Let's allow Assigned Employee too for debugging/verification, or strictly Client/Boss.
        // User prompt: "Permitir si role == 'client' y owner... Permitir si role == 'boss'... Denegar a employee"
        const isOwner = request.clientId === uid;
        const isBoss = role === 'boss';

        if (!isOwner && !isBoss) {
            return res.status(403).json({
                ok: false,
                error: 'forbidden',
                message: 'No tienes permiso para ver este presupuesto.'
            });
        }

        // 3. Audit: Log the structure for debugging
        logger.debug(`Generating PDF URL for Request: ${requestId}`);

        // 4. Robust Public ID Resolution (Waterfall / Cascade)
        let publicId = null;
        let pdfMeta = null;

        // CHECK A: Embedded Proposal (Standard)
        if (request.proposal?.estimatePdf?.public_id) {
            publicId = request.proposal.estimatePdf.public_id;
            pdfMeta = request.proposal.estimatePdf;
        }
        // CHECK A.2: Direct Estimate PDF (Request Root)
        else if (request.estimatePdf?.public_id) {
            publicId = request.estimatePdf.public_id;
            pdfMeta = request.estimatePdf;
        }
        // CHECK B: Variants (current/active/array)
        else if (request.currentProposal?.estimatePdf?.public_id) {
            publicId = request.currentProposal.estimatePdf.public_id;
            pdfMeta = request.currentProposal.estimatePdf;
        }
        else if (request.activeProposal?.estimatePdf?.public_id) {
            publicId = request.activeProposal.estimatePdf.public_id;
            pdfMeta = request.activeProposal.estimatePdf;
        }
        else if (Array.isArray(request.proposals)) {
            const prop = request.proposals.find(p => p?.estimatePdf?.public_id);
            if (prop) {
                publicId = prop.estimatePdf.public_id;
                pdfMeta = prop.estimatePdf;
            }
        }

        // CHECK C: Lazy Load via Proposal ID (The "Second Fetch")
        if (!publicId && request.proposalId && typeof request.proposalId === 'string') {
            logger.debug(`PDF not found in request, fetching Proposal ID: ${request.proposalId}`);
            try {
                const separateProposal = await marketplaceService.getProposal(request.proposalId);
                if (separateProposal?.estimatePdf?.public_id) {
                    publicId = separateProposal.estimatePdf.public_id;
                    pdfMeta = separateProposal.estimatePdf;
                    logger.debug('Found PDF in separate proposal document.');
                }
            } catch (err) {
                logger.warn(`Failed to fetch separate proposal: ${err.message}`);
                // Continue, publicId remains null
            }
        }

        // 5. Strict Validation: Return 404/400 instead of 500
        if (typeof publicId === 'string') {
            publicId = publicId.trim();
            if (!publicId) {
                logger.warn(`PDF_NOT_FOUND for req ${requestId}. Public ID empty after trim.`);
                return res.status(404).json({ ok: false, error: 'pdf_not_found' });
            }
        }

        if (!publicId) {
            logger.warn(`PDF_NOT_FOUND for req ${requestId}. Public ID missing after waterfall check.`);
            return res.status(404).json({ ok: false, error: 'pdf_not_found', message: 'No hay presupuesto PDF adjunto.' });
        }

        if (typeof publicId !== 'string') {
            logger.warn(`INVALID_PDF_ID for req ${requestId}:`, typeof publicId);
            return res.status(400).json({ ok: false, error: 'invalid_pdf_id', message: 'Error de datos: ID de PDF inválido.' });
        }

        // 6. Generate Signed URL (Safe Call)
        // Ensure resource_type/type default to checking meta or falling back to defaults if meta missing (unlikely if id found)
        const resourceType = pdfMeta?.resource_type || 'raw';
        const type = pdfMeta?.type || 'private';

        const authTokenKey = process.env.CLOUDINARY_AUTH_TOKEN_KEY || cloudinary.config().auth_token?.key || null;
        if (type === 'authenticated' && !authTokenKey) {
            logger.warn('Auth token missing for authenticated PDF. Re-upload as private or set CLOUDINARY_AUTH_TOKEN_KEY.');
            return res.status(409).json({
                ok: false,
                error: 'auth_token_missing',
                message: 'El PDF fue subido como authenticated. Re-súbelo como private o configura CLOUDINARY_AUTH_TOKEN_KEY.'
            });
        }

        const signedUrlOptions = {
            resource_type: resourceType,
            type: type,
            sign_url: true,
            expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 mins
            secure: true,
        };

        if (type === 'authenticated' && authTokenKey) {
            signedUrlOptions.auth_token = { key: authTokenKey, duration: 1800 };
        }

        const signedUrl = cloudinary.url(publicId, signedUrlOptions);

        // 7. Anti-Cache Headers
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        logger.debug(`Generated Signed URL for public_id: ${publicId}`);

        return res.status(200).json({
            ok: true,
            url: signedUrl
        });

    } catch (err) {
        logger.error('getEstimateUrl FATAL error:', err);
        return res.status(500).json({
            ok: false,
            error: 'server_error',
            message: 'Error interno al generar PDF.',
            details: err.message
        });
    }
}

// ============================================================
// Exports
// ============================================================

module.exports = {
    // Client
    createRequest,
    createEmergencyCall,
    listClientRequests,
    listEmergencyCalls,
    getEmergencyCall,
    listAvailableRequests,
    getRequest,
    cancelRequest,
    acceptProposal,
    rejectProposal,
    clientClose,
    submitPaymentProof,
    notifyBossPaymentReview,
    clientCloseEmergencyCall,
    submitEmergencyPaymentProof,
    notifyBossEmergencyPaymentReview,
    getEstimateUrl, // New export

    // Employee
    listEmployeeRequests,
    getActiveJob,
    getNextQuoteNumber,
    acceptEmergencyCall,
    resolveEmergencyCall,
    deleteEmergencyCall,
    updateEmergencyLocation,
    listEmergencyChatMessages,
    sendEmergencyChatMessage: sendEmergencyChatMessageHandler,
    claimRequest,
    releaseClaim,
    sendProposal,
    markFinished,
    renderEstimatePdf,
    uploadEstimate,

    // Boss
    approvePayment,
    rejectPayment,
    approveEmergencyPayment,
    rejectEmergencyPayment,
    listAllRequests,
    listBossEmployees,
    assignRequestToEmployee,
    assignEmergencyCallToEmployee,
    unassignRequestByBoss,
    listPendingPayments,
    listBossReviewQueue,

    // Chat
    listChatMessages,
    sendChatMessage: sendChatMessageHandler
};

