'use strict';

/**
 * Marketplace Service (Production)
 * 
 * Core business logic for the electrician marketplace.
 * Uses canonical 9-state machine with strict transitions.
 * 
 * Collection: 'requests'
 */

const { admin, db } = require('../firebase');
const { appError } = require('../utils/errors');
const { createLogger } = require('../utils/logger');
const {
    STATUS,
    EMPLOYEE_ACTIVE_STATUSES,
    assertTransition,
} = require('../marketplace.constants');

const REQUESTS_COLLECTION = 'requests';
const EMERGENCY_COLLECTION = 'emergencyCalls';
const PROPOSALS_COLLECTION = 'proposals';
const SYSTEM_COLLECTION = 'system';
const QUOTE_COUNTER_DOC = 'quoteCounter';
const logger = createLogger('marketplace.service');
const { canDeleteEmergencyCall } = require('./marketplaceAccess');

// ============================================================
// Helpers
// ============================================================

function serverTimestamp() {
    return admin.firestore.FieldValue.serverTimestamp();
}

function toMillis(value) {
    if (value == null) return 0;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const ms = Date.parse(value);
        return Number.isFinite(ms) ? ms : 0;
    }
    if (value && typeof value.toDate === 'function') {
        const date = value.toDate();
        const ms = date instanceof Date ? date.getTime() : 0;
        return Number.isFinite(ms) ? ms : 0;
    }
    return 0;
}

function requireNonEmptyString(value, label) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw appError(400, 'invalid_input', `${label} es requerido.`);
    }
    return value.trim();
}

function mapDoc(doc) {
    if (!doc.exists) return null;
    const data = doc.data() || {};
    const result = { id: doc.id };
    for (const [key, value] of Object.entries(data)) {
        if (value && typeof value.toDate === 'function') {
            result[key] = value.toDate().toISOString();
        } else {
            result[key] = value;
        }
    }
    return result;
}

function normalizeEmergencyPriority(value) {
    const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (raw === 'critical' || raw === 'high' || raw === 'normal') return raw;
    return 'urgent';
}

function normalizeEmergencyStatus(value) {
    const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (
        raw === 'accepted'
        || raw === 'awaiting_client_close'
        || raw === 'awaiting_payment_proof'
        || raw === 'payment_pending_review'
        || raw === 'completed'
    ) {
        return raw;
    }
    return 'pending';
}

function normalizeEmergencyDispatchMode(value) {
    const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return raw === 'scheduled' ? 'scheduled' : 'emergency';
}

function normalizeEmergencySchedule(payload = {}) {
    const scheduledDate = typeof payload.scheduledDate === 'string' ? payload.scheduledDate.trim() : '';
    const scheduledTime = typeof payload.scheduledTime === 'string' ? payload.scheduledTime.trim() : '';
    const scheduledForRaw = typeof payload.scheduledFor === 'string' ? payload.scheduledFor.trim() : '';
    const fallbackRaw = scheduledDate && scheduledTime ? `${scheduledDate}T${scheduledTime}:00` : scheduledForRaw;
    if (!fallbackRaw) {
        return {
            scheduledDate: null,
            scheduledTime: null,
            scheduledFor: null,
            scheduledForMs: null,
        };
    }

    const parsed = new Date(fallbackRaw);
    if (Number.isNaN(parsed.getTime())) {
        throw appError(400, 'invalid_input', 'Fecha programada invalida.');
    }

    return {
        scheduledDate: scheduledDate || parsed.toISOString().slice(0, 10),
        scheduledTime: scheduledTime || parsed.toISOString().slice(11, 16),
        scheduledFor: parsed.toISOString(),
        scheduledForMs: parsed.getTime(),
    };
}

function normalizeEmergencyCoords(input) {
    if (!input || typeof input !== 'object') return null;

    const latRaw = Number(input.lat ?? input.latitude);
    const lngRaw = Number(input.lng ?? input.longitude);
    const accuracyRaw = Number(input.accuracy);

    if (!Number.isFinite(latRaw) || latRaw < -90 || latRaw > 90) return null;
    if (!Number.isFinite(lngRaw) || lngRaw < -180 || lngRaw > 180) return null;

    return {
        lat: latRaw,
        lng: lngRaw,
        accuracy: Number.isFinite(accuracyRaw) && accuracyRaw >= 0 ? accuracyRaw : null,
        updatedAtMs: Date.now(),
    };
}

function resolveEmergencyWorkflowStatus(data = {}) {
    const baseStatus = normalizeEmergencyStatus(data.status);

    if (data.bossApprovedAt || data.bossApprovedAtMs) return 'completed';
    if (data.paymentProofAt || data.paymentProofAtMs || data.paymentProofUrl) return 'payment_pending_review';
    if (data.clientClosedAt || data.clientClosedAtMs || data.finalAmount != null || data.finalPhotoUrl) return 'awaiting_payment_proof';
    if (data.finishedAt || data.finishedAtMs || data.quotedAmount != null) return 'awaiting_client_close';
    if (data.assignedEmployeeId) return 'accepted';
    return baseStatus;
}

function mapEmergencyDoc(doc) {
    const result = mapDoc(doc);
    if (!result) return null;
    result.status = resolveEmergencyWorkflowStatus(result);
    result.dispatchMode = normalizeEmergencyDispatchMode(result.dispatchMode || result.mode || result.serviceType);
    return result;
}

const EMERGENCY_CLIENT_BLOCKING_STATUSES = new Set([
    'pending',
    'accepted',
    'awaiting_client_close',
]);

const EMERGENCY_ACTIVE_STATUSES = new Set([
    'accepted',
    'awaiting_client_close',
    'awaiting_payment_proof',
    'payment_pending_review',
]);

const EMERGENCY_CHAT_STATUSES = new Set([
    'accepted',
    'awaiting_client_close',
    'awaiting_payment_proof',
    'payment_pending_review',
]);

function isEmergencyActiveStatus(status) {
    return EMERGENCY_ACTIVE_STATUSES.has(normalizeEmergencyStatus(status));
}

function isEmergencyClientBlockingStatus(status) {
    return EMERGENCY_CLIENT_BLOCKING_STATUSES.has(normalizeEmergencyStatus(status));
}

function isEmergencyChatAllowed(status) {
    return EMERGENCY_CHAT_STATUSES.has(normalizeEmergencyStatus(status));
}

function canAccessEmergencyChat(call, userUid, userRole) {
    if (!call || typeof call !== 'object') return false;
    if (userRole === 'boss') return true;
    if (call.clientId === userUid) return true;
    if (call.assignedEmployeeId === userUid) return true;
    return false;
}

// ============================================================
// Create Request (Client)
// ============================================================

/**
 * Creates a new service request in EN_ESPERA status.
 */
async function createRequest(clientUid, payload, clientInfo = {}) {
    requireNonEmptyString(clientUid, 'clientUid');

    if (!payload || typeof payload !== 'object') {
        throw appError(400, 'invalid_input', 'Request payload es requerido.');
    }

    const description = requireNonEmptyString(payload.description, 'description');
    const address = requireNonEmptyString(payload.address, 'address');

    const category = typeof payload.category === 'string' && payload.category.trim()
        ? payload.category.trim().toLowerCase()
        : 'electricidad';

    // Support single photoUrl or array of photoUrls
    let photoUrl = null;
    if (typeof payload.photoUrl === 'string' && payload.photoUrl.trim()) {
        photoUrl = payload.photoUrl.trim();
    } else if (Array.isArray(payload.photoUrls) && payload.photoUrls.length > 0) {
        photoUrl = payload.photoUrls[0]; // Take first photo
    }

    const requestRef = db.collection(REQUESTS_COLLECTION).doc();

    const requestData = {
        // Client info
        clientId: clientUid,
        clientEmail: clientInfo.email || null,
        clientNickname: clientInfo.nickname || null,
        isGuestClient: Boolean(clientInfo.isGuest),

        // Request details
        category,
        description,
        address,
        photoUrl,

        // Status (canonical)
        status: STATUS.EN_ESPERA,

        // Employee assignment
        assignedEmployeeId: null,
        assignedAt: null,
        employeeEmail: null,
        employeeName: null,

        // Proposal
        proposal: null,

        // Work completion
        finishedAt: null,

        // Client close
        clientClosedAt: null,
        finalAmount: null,
        finalPhotoUrl: null,
        clientRating: null,

        // Payment
        paymentProofUrl: null,
        paymentProofAt: null,
        bossApprovedAt: null,

        // Timestamps
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    await requestRef.set(requestData);

    const fresh = await requestRef.get();
    logger.info('Request created:', fresh.id, 'status:', STATUS.EN_ESPERA);
    return mapDoc(fresh);
}

// ============================================================
// List Requests
// ============================================================

/**
 * Lists EN_ESPERA requests for employees to claim.
 */
async function listAvailableRequests(options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 100);

    logger.debug('listAvailableRequests called, limit:', limit);

    const snap = await db.collection(REQUESTS_COLLECTION)
        .where('status', '==', STATUS.EN_ESPERA)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

    logger.debug('listAvailableRequests found:', snap.docs.length, 'requests');
    return snap.docs.map(mapDoc);
}

/**
 * Lists all requests for a specific client.
 */
async function listClientRequests(clientUid, options = {}) {
    requireNonEmptyString(clientUid, 'clientUid');
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 100);

    const snap = await db.collection(REQUESTS_COLLECTION)
        .where('clientId', '==', clientUid)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

    return snap.docs.map(mapDoc);
}

/**
 * Lists requests assigned to a specific employee.
 */
async function listEmployeeRequests(employeeUid, options = {}) {
    requireNonEmptyString(employeeUid, 'employeeUid');
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 100);

    const snap = await db.collection(REQUESTS_COLLECTION)
        .where('assignedEmployeeId', '==', employeeUid)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

    return snap.docs.map(mapDoc);
}

/**
 * Gets a single request by ID.
 */
async function getRequest(requestId) {
    requireNonEmptyString(requestId, 'requestId');

    const doc = await db.collection(REQUESTS_COLLECTION).doc(requestId).get();
    if (!doc.exists) {
        throw appError(404, 'not_found', 'Solicitud no encontrada.');
    }

    return mapDoc(doc);
}

// ============================================================
// Emergency Calls
// ============================================================

async function createEmergencyCall(clientUid, payload, clientInfo = {}) {
    requireNonEmptyString(clientUid, 'clientUid');

    if (!payload || typeof payload !== 'object') {
        throw appError(400, 'invalid_input', 'Emergency payload es requerido.');
    }

    const clientName = requireNonEmptyString(payload.clientName, 'clientName');
    const phone = requireNonEmptyString(payload.phone, 'phone');
    const location = requireNonEmptyString(payload.location, 'location');
    const issue = requireNonEmptyString(payload.issue, 'issue');
    const priority = normalizeEmergencyPriority(payload.priority);
    const dispatchMode = normalizeEmergencyDispatchMode(payload.dispatchMode || payload.mode || payload.serviceType);
    const etaRaw = Number(payload.eta);
    const eta = Number.isFinite(etaRaw) && etaRaw >= 0 ? etaRaw : 30;
    const clientCoords = normalizeEmergencyCoords(payload.clientCoords);
    const schedule = dispatchMode === 'scheduled'
        ? normalizeEmergencySchedule(payload)
        : { scheduledDate: null, scheduledTime: null, scheduledFor: null, scheduledForMs: null };

    const existingSnap = await db.collection(EMERGENCY_COLLECTION)
        .where('clientId', '==', clientUid)
        .limit(25)
        .get();

    const activeBlockingDoc = existingSnap.docs.find((snap) => {
        return isEmergencyClientBlockingStatus(resolveEmergencyWorkflowStatus(snap.data() || {}));
    });

    if (activeBlockingDoc) {
        const activeData = activeBlockingDoc.data() || {};
        const activeMode = normalizeEmergencyDispatchMode(activeData.dispatchMode || activeData.mode || activeData.serviceType);
        throw appError(
            409,
            'emergency_already_active',
            activeMode === 'scheduled'
                ? 'Ya tienes un trabajo programado activo.'
                : 'Ya tienes un servicio activo.'
        );
    }

    const emergencyRef = db.collection(EMERGENCY_COLLECTION).doc();
    await emergencyRef.set({
        clientId: clientUid,
        clientEmail: clientInfo.email || null,
        clientName,
        phone,
        location,
        issue,
        priority,
        eta,
        dispatchMode,
        scheduledDate: schedule.scheduledDate,
        scheduledTime: schedule.scheduledTime,
        scheduledFor: schedule.scheduledFor,
        scheduledForMs: schedule.scheduledForMs,
        status: 'pending',
        clientCoords,
        employeeCoords: null,
        assignedEmployeeId: null,
        assignedEmployeeEmail: null,
        assignedEmployeeName: null,
        acceptedAt: null,
        finishedAt: null,
        finishedById: null,
        finishedByEmail: null,
        finishedByName: null,
        quotedAmount: null,
        finalAmount: null,
        clientRating: null,
        finalPhotoUrl: null,
        clientClosedAt: null,
        paymentProofUrl: null,
        paymentProofAt: null,
        paymentProofBy: null,
        bossApprovedAt: null,
        bossApprovedBy: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
    });

    const fresh = await emergencyRef.get();
    return mapEmergencyDoc(fresh);
}

async function listEmergencyCalls(userUid, userRole, options = {}) {
    requireNonEmptyString(userUid, 'userUid');
    requireNonEmptyString(userRole, 'userRole');

    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 100);
    const normalizedRole = String(userRole).trim().toLowerCase();
    const statusFilter = typeof options.status === 'string' ? options.status.trim().toLowerCase() : '';
    const rawModeFilter = typeof options.mode === 'string' ? options.mode.trim().toLowerCase() : '';
    const wantsAllModes = rawModeFilter === 'all';
    const wantsScheduled = rawModeFilter === 'scheduled';

    let ref = db.collection(EMERGENCY_COLLECTION);

    if (normalizedRole === 'client') {
        ref = ref.where('clientId', '==', userUid);
    } else if (normalizedRole === 'boss') {
        if (statusFilter) {
            ref = ref.where('status', '==', normalizeEmergencyStatus(statusFilter));
        } else {
            ref = ref.orderBy('createdAtMs', 'desc');
        }
    } else if (statusFilter) {
        ref = ref.where('status', '==', normalizeEmergencyStatus(statusFilter));
    } else {
        ref = ref.orderBy('createdAtMs', 'desc');
    }

    const snap = await ref.limit(limit).get();
    let calls = snap.docs.map(mapEmergencyDoc);

    if (normalizedRole === 'employee') {
        calls = calls.filter((call) => {
            const status = normalizeEmergencyStatus(call?.status);
            if (status === 'pending') return true;
            return call?.assignedEmployeeId === userUid;
        });
    }

    if (!wantsAllModes) {
        calls = calls.filter((call) => {
            const dispatchMode = normalizeEmergencyDispatchMode(call?.dispatchMode || call?.mode || call?.serviceType);
            return wantsScheduled ? dispatchMode === 'scheduled' : dispatchMode !== 'scheduled';
        });
    }

    return calls.sort((a, b) => {
        const aTime = Number(a?.createdAtMs || 0);
        const bTime = Number(b?.createdAtMs || 0);
        return bTime - aTime;
    });
}

async function acceptEmergencyCall(callId, employeeUid, employeeInfo = {}, actorRole = 'employee') {
    requireNonEmptyString(callId, 'callId');
    requireNonEmptyString(employeeUid, 'employeeUid');

    const normalizedActorRole = String(actorRole).trim().toLowerCase();
    if (normalizedActorRole !== 'boss') {
        const activeAssignmentsSnap = await db.collection(EMERGENCY_COLLECTION)
            .where('assignedEmployeeId', '==', employeeUid)
            .limit(25)
            .get();

        const hasAnotherActiveEmergency = activeAssignmentsSnap.docs.some((doc) => {
            if (doc.id === callId) return false;
            return isEmergencyActiveStatus(resolveEmergencyWorkflowStatus(doc.data() || {}));
        });

        if (hasAnotherActiveEmergency) {
            throw appError(409, 'employee_already_busy', 'Solo puedes tomar una emergencia a la vez hasta terminarla.');
        }
    }

    const ref = db.collection(EMERGENCY_COLLECTION).doc(callId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Emergencia no encontrada.');
        }

        const data = snap.data() || {};
        const status = resolveEmergencyWorkflowStatus(data);

        if (status === 'completed') {
            throw appError(400, 'already_completed', 'La emergencia ya fue completada.');
        }

        if (
            status === 'accepted' &&
            data.assignedEmployeeId &&
            data.assignedEmployeeId !== employeeUid &&
            normalizedActorRole !== 'boss'
        ) {
            throw appError(409, 'already_taken', 'La emergencia ya fue aceptada por otro tecnico.');
        }

        tx.update(ref, {
            status: 'accepted',
            assignedEmployeeId: employeeUid,
            assignedEmployeeEmail: employeeInfo.email || null,
            assignedEmployeeName: employeeInfo.name || null,
            acceptedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            updatedAtMs: Date.now(),
        });
    });

    const fresh = await ref.get();
    return mapEmergencyDoc(fresh);
}

async function resolveEmergencyCall(callId, actorUid, actorRole = 'employee', actorInfo = {}, payload = {}) {
    requireNonEmptyString(callId, 'callId');
    requireNonEmptyString(actorUid, 'actorUid');

    const quotedAmount = Number(payload.amount ?? payload.quotedAmount ?? payload.finalAmount);
    if (!Number.isFinite(quotedAmount) || quotedAmount < 0) {
        throw appError(400, 'invalid_input', 'Monto invalido.');
    }

    const ref = db.collection(EMERGENCY_COLLECTION).doc(callId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Emergencia no encontrada.');
        }

        const data = snap.data() || {};
        const status = resolveEmergencyWorkflowStatus(data);

        if (status !== 'accepted') {
            throw appError(400, 'invalid_state', 'Solo una emergencia aceptada se puede finalizar.');
        }

        const isOwner = data.assignedEmployeeId === actorUid;
        const isBoss = String(actorRole).trim().toLowerCase() === 'boss';
        if (!isOwner && !isBoss) {
            throw appError(403, 'forbidden', 'Solo el tecnico asignado puede resolver esta emergencia.');
        }

        tx.update(ref, {
            status: 'awaiting_client_close',
            quotedAmount,
            finishedAt: serverTimestamp(),
            finishedAtMs: Date.now(),
            finishedById: actorUid,
            finishedByEmail: actorInfo.email || null,
            finishedByName: actorInfo.name || null,
            updatedAt: serverTimestamp(),
            updatedAtMs: Date.now(),
        });
    });

    const fresh = await ref.get();
    return mapEmergencyDoc(fresh);
}

async function deleteEmergencyCall(callId, actor = {}) {
    requireNonEmptyString(callId, 'callId');

    const actorUid = typeof actor.uid === 'string' ? actor.uid.trim() : '';
    const actorRole = typeof actor.role === 'string' ? actor.role.trim().toLowerCase() : '';
    if (!actorUid || !actorRole) {
        throw appError(403, 'forbidden', 'No tienes permisos para eliminar esta emergencia.');
    }

    const ref = db.collection(EMERGENCY_COLLECTION).doc(callId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw appError(404, 'not_found', 'Emergencia no encontrada.');
    }

    const call = mapEmergencyDoc(snap);
    if (!canDeleteEmergencyCall(call, { uid: actorUid, role: actorRole })) {
        throw appError(403, 'forbidden', 'No tienes permisos para eliminar esta emergencia.');
    }

    await ref.delete();
    return { id: callId };
}

async function clientCloseEmergencyCall(callId, clientUid, closeData = {}) {
    requireNonEmptyString(callId, 'callId');
    requireNonEmptyString(clientUid, 'clientUid');

    const finalAmount = Number(closeData.finalAmount);
    if (!Number.isFinite(finalAmount) || finalAmount < 0) {
        throw appError(400, 'invalid_input', 'Monto final invalido.');
    }

    const clientRating = Number(closeData.clientRating);
    if (!Number.isInteger(clientRating) || clientRating < 1 || clientRating > 5) {
        throw appError(400, 'invalid_input', 'La puntuacion debe ser entre 1 y 5.');
    }

    const finalPhotoUrl = requireNonEmptyString(closeData.finalPhotoUrl, 'finalPhotoUrl');

    const ref = db.collection(EMERGENCY_COLLECTION).doc(callId);
    let employeeId = null;

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Emergencia no encontrada.');
        }

        const data = snap.data() || {};
        employeeId = data.assignedEmployeeId || null;
        const status = resolveEmergencyWorkflowStatus(data);

        if (data.clientId !== clientUid) {
            throw appError(403, 'forbidden', 'Esta no es tu emergencia.');
        }

        if (status !== 'awaiting_client_close') {
            throw appError(400, 'invalid_state', 'La emergencia no esta lista para cierre del cliente.');
        }

        tx.update(ref, {
            status: 'awaiting_payment_proof',
            finalAmount,
            clientRating,
            finalPhotoUrl,
            clientClosedAt: serverTimestamp(),
            clientClosedAtMs: Date.now(),
            updatedAt: serverTimestamp(),
            updatedAtMs: Date.now(),
        });
    });

    if (employeeId) {
        const employeeProfileService = require('./employee-profile.service');
        try {
            await employeeProfileService.addPortfolioPhoto(employeeId, finalPhotoUrl);
            await employeeProfileService.updateRating(employeeId, clientRating);
        } catch (err) {
            logger.error('Error updating employee profile from emergency:', err);
        }
    }

    const fresh = await ref.get();
    return mapEmergencyDoc(fresh);
}

async function submitEmergencyPaymentProof(callId, actorUid, proofUrl) {
    requireNonEmptyString(callId, 'callId');
    requireNonEmptyString(actorUid, 'actorUid');
    requireNonEmptyString(proofUrl, 'proofUrl');

    const ref = db.collection(EMERGENCY_COLLECTION).doc(callId);
    let shouldReturnCurrent = false;

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Emergencia no encontrada.');
        }

        const data = snap.data() || {};
        const status = resolveEmergencyWorkflowStatus(data);
        const isEmployee = data.assignedEmployeeId === actorUid;
        if (!isEmployee) {
            throw appError(403, 'forbidden', 'Solo el tecnico asignado puede enviar comprobante.');
        }

        if (status === 'payment_pending_review' && data.paymentProofBy === actorUid) {
            shouldReturnCurrent = true;
            return;
        }

        if (status === 'completed') {
            shouldReturnCurrent = true;
            return;
        }

        if (status !== 'awaiting_payment_proof') {
            throw appError(400, 'invalid_state', 'La emergencia no esta esperando comprobante.');
        }

        tx.update(ref, {
            status: 'payment_pending_review',
            paymentProofUrl: proofUrl,
            paymentProofAt: serverTimestamp(),
            paymentProofAtMs: Date.now(),
            paymentProofBy: actorUid,
            paymentRejectedAt: null,
            paymentRejectedAtMs: null,
            paymentRejectedBy: null,
            paymentRejectionReason: null,
            updatedAt: serverTimestamp(),
            updatedAtMs: Date.now(),
        });
    });

    const fresh = await ref.get();
    const result = mapEmergencyDoc(fresh);
    if (shouldReturnCurrent && result) {
        return result;
    }
    return result;
}

async function approveEmergencyPayment(callId, bossUid) {
    requireNonEmptyString(callId, 'callId');
    requireNonEmptyString(bossUid, 'bossUid');

    const ref = db.collection(EMERGENCY_COLLECTION).doc(callId);
    let callData = null;

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Emergencia no encontrada.');
        }

        const data = snap.data() || {};
        callData = data;
        const status = resolveEmergencyWorkflowStatus(data);
        if (status !== 'payment_pending_review') {
            throw appError(400, 'invalid_state', 'La emergencia no esta esperando aprobacion de pago.');
        }

        tx.update(ref, {
            status: 'completed',
            bossApprovedAt: serverTimestamp(),
            bossApprovedAtMs: Date.now(),
            bossApprovedBy: bossUid,
            updatedAt: serverTimestamp(),
            updatedAtMs: Date.now(),
        });
    });

    // Record earnings (20% commission) for emergency approvals as well.
    const finalAmount = Number(callData?.finalAmount ?? callData?.quotedAmount);
    if (Number.isFinite(finalAmount) && finalAmount > 0) {
        const earningsService = require('./earnings.service');
        try {
            await earningsService.recordEarning({
                requestId: `emergency:${callId}`,
                finalAmount,
                employeeId: callData?.assignedEmployeeId,
                employeeName: callData?.assignedEmployeeName,
                employeeEmail: callData?.assignedEmployeeEmail,
                description: callData?.description,
                address: callData?.address
            });
        } catch (err) {
            logger.error('Error recording emergency earning:', err);
            // Keep payment approval successful even if earnings logging fails.
        }
    }

    const fresh = await ref.get();
    return mapEmergencyDoc(fresh);
}

async function rejectEmergencyPayment(callId, bossUid, reason = '') {
    requireNonEmptyString(callId, 'callId');
    requireNonEmptyString(bossUid, 'bossUid');
    const cleanReason = typeof reason === 'string' ? reason.trim().slice(0, 300) : '';

    const ref = db.collection(EMERGENCY_COLLECTION).doc(callId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Emergencia no encontrada.');
        }

        const data = snap.data() || {};
        const status = resolveEmergencyWorkflowStatus(data);
        if (status !== 'payment_pending_review') {
            throw appError(400, 'invalid_state', 'La emergencia no esta esperando aprobacion de pago.');
        }

        tx.update(ref, {
            status: 'awaiting_payment_proof',
            paymentProofUrl: null,
            paymentProofAt: null,
            paymentProofAtMs: null,
            paymentProofBy: null,
            paymentRejectedAt: serverTimestamp(),
            paymentRejectedAtMs: Date.now(),
            paymentRejectedBy: bossUid,
            paymentRejectionReason: cleanReason || null,
            updatedAt: serverTimestamp(),
            updatedAtMs: Date.now(),
        });
    });

    const fresh = await ref.get();
    return mapEmergencyDoc(fresh);
}

async function listEmergencyChatMessages(callId, userUid, userRole, options = {}) {
    requireNonEmptyString(callId, 'callId');
    requireNonEmptyString(userUid, 'userUid');

    const callDoc = await db.collection(EMERGENCY_COLLECTION).doc(callId).get();
    if (!callDoc.exists) {
        throw appError(404, 'not_found', 'Emergencia no encontrada.');
    }

    const call = mapEmergencyDoc(callDoc);
    if (!canAccessEmergencyChat(call, userUid, userRole)) {
        throw appError(403, 'forbidden', 'No tienes acceso al chat de esta emergencia.');
    }

    if (!isEmergencyChatAllowed(call.status)) {
        return [];
    }

    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 100);
    const snap = await db.collection(EMERGENCY_COLLECTION)
        .doc(callId)
        .collection('chat')
        .orderBy('createdAt', 'asc')
        .limit(limit)
        .get();

    return snap.docs.map((doc) => {
        const data = doc.data() || {};
        return {
            id: doc.id,
            text: data.text || '',
            senderId: data.senderId || '',
            senderRole: data.senderRole || '',
            senderName: data.senderName || '',
            attachments: Array.isArray(data.attachments) ? data.attachments : [],
            createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        };
    });
}

async function sendEmergencyChatMessage(callId, userUid, userRole, text, senderName = '', attachments = []) {
    requireNonEmptyString(callId, 'callId');
    requireNonEmptyString(userUid, 'userUid');

    const cleanText = typeof text === 'string' ? text.trim() : '';
    const cleanAttachments = Array.isArray(attachments)
        ? attachments.filter((item) => typeof item === 'string' && item.trim() !== '')
        : [];

    if (!cleanText && cleanAttachments.length === 0) {
        throw appError(400, 'invalid_input', 'text o adjuntos son requeridos.');
    }

    const callDoc = await db.collection(EMERGENCY_COLLECTION).doc(callId).get();
    if (!callDoc.exists) {
        throw appError(404, 'not_found', 'Emergencia no encontrada.');
    }

    const call = mapEmergencyDoc(callDoc);
    if (!canAccessEmergencyChat(call, userUid, userRole)) {
        throw appError(403, 'forbidden', 'No tienes acceso al chat de esta emergencia.');
    }

    if (!isEmergencyChatAllowed(call.status)) {
        throw appError(400, 'chat_not_allowed', `No se puede chatear en estado ${call.status}.`);
    }

    if (userRole === 'client' && cleanAttachments.length > 0) {
        const snap = await db.collection(EMERGENCY_COLLECTION)
            .doc(callId)
            .collection('chat')
            .where('senderId', '==', userUid)
            .get();

        let used = 0;
        snap.forEach((doc) => {
            const data = doc.data() || {};
            if (Array.isArray(data.attachments)) used += data.attachments.length;
        });

        const remaining = MAX_CLIENT_CHAT_ATTACHMENTS - used;
        if (remaining <= 0) {
            throw appError(400, 'invalid_input', `Ya alcanzaste el máximo de ${MAX_CLIENT_CHAT_ATTACHMENTS} fotos en este chat.`);
        }
        if (cleanAttachments.length > remaining) {
            throw appError(400, 'invalid_input', `Solo puedes enviar ${remaining} foto(s) más en este chat.`);
        }
    }

    const msgRef = db.collection(EMERGENCY_COLLECTION)
        .doc(callId)
        .collection('chat')
        .doc();

    const payload = {
        text: cleanText.substring(0, 1000),
        attachments: cleanAttachments.slice(0, 3),
        senderId: userUid,
        senderRole: userRole,
        senderName: senderName || '',
        createdAt: serverTimestamp(),
    };

    await msgRef.set(payload);

    return {
        id: msgRef.id,
        ...payload,
        createdAt: new Date().toISOString(),
    };
}

async function updateEmergencyLocation(callId, actorUid, actorRole, payload = {}) {
    requireNonEmptyString(callId, 'callId');
    requireNonEmptyString(actorUid, 'actorUid');
    requireNonEmptyString(actorRole, 'actorRole');

    const coords = normalizeEmergencyCoords(payload);
    if (!coords) {
        throw appError(400, 'invalid_input', 'Coordenadas invalidas.');
    }

    const ref = db.collection(EMERGENCY_COLLECTION).doc(callId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Emergencia no encontrada.');
        }

        const data = snap.data() || {};
        const status = resolveEmergencyWorkflowStatus(data);
        if (status === 'completed') {
            throw appError(400, 'invalid_state', 'La emergencia ya fue completada.');
        }

        const normalizedRole = String(actorRole).trim().toLowerCase();
        const updates = {
            updatedAt: serverTimestamp(),
            updatedAtMs: Date.now(),
        };

        if (normalizedRole === 'client') {
            if (data.clientId !== actorUid) {
                throw appError(403, 'forbidden', 'Esta no es tu emergencia.');
            }
            updates.clientCoords = coords;
        } else {
            const isAssigned = data.assignedEmployeeId === actorUid;
            const isBoss = normalizedRole === 'boss';
            if (!isAssigned && !isBoss) {
                throw appError(403, 'forbidden', 'No puedes actualizar la ubicacion de este tecnico.');
            }
            if (status !== 'accepted') {
                throw appError(400, 'invalid_state', 'Solo puedes compartir ubicacion cuando la emergencia fue aceptada.');
            }
            updates.employeeCoords = coords;
        }

        tx.update(ref, updates);
    });

    const fresh = await ref.get();
    return mapEmergencyDoc(fresh);
}

function formatQuoteNumber(counterValue) {
    return `QU${String(counterValue).padStart(6, '0')}`;
}

function formatEmployeeIdentifier(source) {
    const raw = typeof source === 'string' ? source.trim() : '';
    const token = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const tail = token ? token.slice(-6).padStart(6, '0') : '000000';
    return `EMP-${tail}`;
}

async function allocateNextQuoteNumber() {
    const counterRef = db.collection(SYSTEM_COLLECTION).doc(QUOTE_COUNTER_DOC);

    const nextValue = await db.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef);
        const currentValue = snap.exists ? Number(snap.data()?.lastValue || 0) : 0;
        const safeCurrent = Number.isFinite(currentValue) && currentValue >= 0 ? currentValue : 0;
        const newValue = safeCurrent + 1;

        tx.set(
            counterRef,
            {
                lastValue: newValue,
                updatedAt: serverTimestamp()
            },
            { merge: true }
        );

        return newValue;
    });

    return formatQuoteNumber(nextValue);
}

/**
 * Gets a single proposal by ID (legacy support for separate proposals collection).
 */
async function getProposal(proposalId) {
    requireNonEmptyString(proposalId, 'proposalId');

    const doc = await db.collection(PROPOSALS_COLLECTION).doc(proposalId).get();
    if (!doc.exists) {
        throw appError(404, 'not_found', 'Propuesta no encontrada.');
    }

    return mapDoc(doc);
}

async function getEmergencyCall(callId) {
    requireNonEmptyString(callId, 'callId');

    const doc = await db.collection(EMERGENCY_COLLECTION).doc(callId).get();
    if (!doc.exists) {
        throw appError(404, 'not_found', 'Emergencia no encontrada.');
    }

    return mapEmergencyDoc(doc);
}

// ============================================================
// Check Active Job
// ============================================================

async function hasActiveJob(employeeUid) {
    const snap = await db.collection(REQUESTS_COLLECTION)
        .where('assignedEmployeeId', '==', employeeUid)
        .where('status', 'in', EMPLOYEE_ACTIVE_STATUSES)
        .limit(1)
        .get();

    return !snap.empty;
}

async function getActiveJobForEmployee(employeeUid) {
    requireNonEmptyString(employeeUid, 'employeeUid');

    const snap = await db.collection(REQUESTS_COLLECTION)
        .where('assignedEmployeeId', '==', employeeUid)
        .where('status', 'in', EMPLOYEE_ACTIVE_STATUSES)
        .limit(1)
        .get();

    if (snap.empty) return null;
    return mapDoc(snap.docs[0]);
}

// ============================================================
// Claim Request (Employee): EN_ESPERA → ASIGNADO
// ============================================================

async function claimRequest(requestId, employeeUid, employeeInfo = {}) {
    requireNonEmptyString(requestId, 'requestId');
    requireNonEmptyString(employeeUid, 'employeeUid');

    // Pre-check: employee must not have active job
    const hasActive = await hasActiveJob(employeeUid);
    if (hasActive) {
        throw appError(409, 'already_has_active_job',
            'Ya tienes un trabajo activo. Complétalo antes de reclamar otro.');
    }

    const requestRef = db.collection(REQUESTS_COLLECTION).doc(requestId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Solicitud no encontrada.');
        }

        const data = snap.data();

        // Validate transition: EN_ESPERA → ASIGNADO
        assertTransition(data.status, STATUS.ASIGNADO, 'employee');

        // Verify not already assigned
        if (data.assignedEmployeeId) {
            throw appError(409, 'already_claimed', 'Esta solicitud ya fue reclamada.');
        }

        tx.update(requestRef, {
            status: STATUS.ASIGNADO,
            assignedEmployeeId: employeeUid,
            assignedAt: serverTimestamp(),
            employeeEmail: employeeInfo.email || null,
            employeeName: employeeInfo.name || null,
            updatedAt: serverTimestamp(),
        });
    });

    const fresh = await requestRef.get();
    logger.info('Request claimed:', requestId, 'by:', employeeUid);
    return mapDoc(fresh);
}

async function assignRequestByBoss(requestId, employeeUid, employeeInfo = {}) {
    requireNonEmptyString(requestId, 'requestId');
    requireNonEmptyString(employeeUid, 'employeeUid');

    const hasActive = await hasActiveJob(employeeUid);
    if (hasActive) {
        throw appError(409, 'already_has_active_job',
            'Ese tecnico ya tiene un trabajo activo. Debe terminarlo antes de tomar otro.');
    }

    const requestRef = db.collection(REQUESTS_COLLECTION).doc(requestId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Solicitud no encontrada.');
        }

        const data = snap.data();

        if (data.status !== STATUS.EN_ESPERA) {
            throw appError(400, 'invalid_state', 'Solo se pueden asignar solicitudes en espera.');
        }

        if (data.assignedEmployeeId) {
            throw appError(409, 'already_claimed', 'Esta solicitud ya fue asignada.');
        }

        tx.update(requestRef, {
            status: STATUS.ASIGNADO,
            assignedEmployeeId: employeeUid,
            assignedAt: serverTimestamp(),
            employeeEmail: employeeInfo.email || null,
            employeeName: employeeInfo.name || null,
            updatedAt: serverTimestamp(),
        });
    });

    const fresh = await requestRef.get();
    logger.info('Request assigned by boss:', requestId, 'to:', employeeUid);
    return mapDoc(fresh);
}

// ============================================================
// Release Claim (Employee): ASIGNADO → EN_ESPERA
// ============================================================

async function releaseClaim(requestId, employeeUid) {
    requireNonEmptyString(requestId, 'requestId');
    requireNonEmptyString(employeeUid, 'employeeUid');

    const requestRef = db.collection(REQUESTS_COLLECTION).doc(requestId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Solicitud no encontrada.');
        }

        const data = snap.data();

        // Authorization: must be assigned employee
        if (data.assignedEmployeeId !== employeeUid) {
            throw appError(403, 'forbidden', 'No eres el empleado asignado.');
        }

        // Validate transition: ASIGNADO → EN_ESPERA
        assertTransition(data.status, STATUS.EN_ESPERA, 'employee');

        tx.update(requestRef, {
            status: STATUS.EN_ESPERA,
            assignedEmployeeId: null,
            assignedAt: null,
            employeeEmail: null,
            employeeName: null,
            proposal: null,
            updatedAt: serverTimestamp(),
        });
    });

    const fresh = await requestRef.get();
    logger.info('Claim released:', requestId);
    return mapDoc(fresh);
}

async function releaseRequestByBoss(requestId) {
    requireNonEmptyString(requestId, 'requestId');

    const requestRef = db.collection(REQUESTS_COLLECTION).doc(requestId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Solicitud no encontrada.');
        }

        const data = snap.data();

        if (data.status !== STATUS.ASIGNADO) {
            throw appError(400, 'invalid_state', 'Solo se pueden liberar solicitudes en estado asignado.');
        }

        if (!data.assignedEmployeeId) {
            throw appError(400, 'invalid_state', 'La solicitud no tiene tecnico asignado.');
        }

        tx.update(requestRef, {
            status: STATUS.EN_ESPERA,
            assignedEmployeeId: null,
            assignedAt: null,
            employeeEmail: null,
            employeeName: null,
            proposal: null,
            updatedAt: serverTimestamp(),
        });
    });

    const fresh = await requestRef.get();
    logger.info('Request unassigned by boss:', requestId);
    return mapDoc(fresh);
}

// ============================================================
// Cancel Request (Client): EN_ESPERA → CANCELADO
// ============================================================

async function cancelRequest(requestId, clientUid) {
    requireNonEmptyString(requestId, 'requestId');
    requireNonEmptyString(clientUid, 'clientUid');

    const requestRef = db.collection(REQUESTS_COLLECTION).doc(requestId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Solicitud no encontrada.');
        }

        const data = snap.data();

        // Authorization: must be owner
        if (data.clientId !== clientUid) {
            throw appError(403, 'forbidden', 'Esta no es tu solicitud.');
        }

        // Validate transition: EN_ESPERA → CANCELADO
        assertTransition(data.status, STATUS.CANCELADO, 'client');

        tx.update(requestRef, {
            status: STATUS.CANCELADO,
            cancelledAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    });

    const fresh = await requestRef.get();
    logger.info('Request cancelled:', requestId);
    return mapDoc(fresh);
}

// ============================================================
// Send Proposal (Employee): ASIGNADO → NEGOCIANDO
// ============================================================

async function sendProposal(requestId, employeeUid, proposalData) {
    requireNonEmptyString(requestId, 'requestId');
    requireNonEmptyString(employeeUid, 'employeeUid');

    if (!proposalData || typeof proposalData !== 'object') {
        throw appError(400, 'invalid_input', 'Datos de propuesta requeridos.');
    }

    const amount = Number(proposalData.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw appError(400, 'invalid_input', 'El monto debe ser un número positivo.');
    }

    const notes = typeof proposalData.notes === 'string' ? proposalData.notes.trim() : '';
    const quoteNumberInput = typeof proposalData.quoteNumber === 'string'
        ? proposalData.quoteNumber.trim().toUpperCase()
        : '';
    const normalizedQuoteNumber = /^QU\d{6,}$/.test(quoteNumberInput)
        ? quoteNumberInput
        : await allocateNextQuoteNumber();
    const quoteDateInput = typeof proposalData.quoteDate === 'string'
        ? proposalData.quoteDate.trim()
        : '';
    const quoteCreatorInput = typeof proposalData.quoteCreatorId === 'string'
        ? proposalData.quoteCreatorId.trim().toUpperCase()
        : '';
    const createdByInput = proposalData.createdBy && typeof proposalData.createdBy === 'object'
        ? proposalData.createdBy
        : null;
    // Support legacy URL string or new secure metadata object
    const estimatePdfUrl = typeof proposalData.estimatePdfUrl === 'string' ? proposalData.estimatePdfUrl.trim() : null;
    const estimatePdf = typeof proposalData.estimatePdf === 'object' ? proposalData.estimatePdf : null;
    const breakdownInput = proposalData.breakdown && typeof proposalData.breakdown === 'object'
        ? proposalData.breakdown
        : null;
    const itemsInput = Array.isArray(proposalData.items) ? proposalData.items : null;

    const requestRef = db.collection(REQUESTS_COLLECTION).doc(requestId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Solicitud no encontrada.');
        }

        const data = snap.data();

        // Authorization
        if (data.assignedEmployeeId !== employeeUid) {
            throw appError(403, 'forbidden', 'No eres el empleado asignado.');
        }

        // Validate transition: ASIGNADO → NEGOCIANDO
        assertTransition(data.status, STATUS.NEGOCIANDO, 'employee');

        const proposal = {
            amount,
            notes,
            sentAt: new Date().toISOString(),
        };

        proposal.quoteNumber = normalizedQuoteNumber;
        if (quoteDateInput) {
            proposal.quoteDate = quoteDateInput.slice(0, 40);
        }

        const creatorUid = employeeUid;
        const creatorEmail = typeof createdByInput?.email === 'string' && createdByInput.email.trim()
            ? createdByInput.email.trim()
            : '';
        const trustedEmail = typeof data.employeeEmail === 'string' ? data.employeeEmail.trim() : '';
        const creatorName = typeof createdByInput?.name === 'string' && createdByInput.name.trim()
            ? createdByInput.name.trim()
            : '';
        const trustedName = typeof data.employeeName === 'string' ? data.employeeName.trim() : '';
        const normalizedCreatorCode = /^EMP-[A-Z0-9]{6,}$/.test(quoteCreatorInput)
            ? quoteCreatorInput
            : formatEmployeeIdentifier(creatorUid || trustedEmail || trustedName || creatorEmail || creatorName);

        proposal.quoteCreatorId = normalizedCreatorCode;
        proposal.createdBy = {
            uid: creatorUid || null,
            email: trustedEmail || creatorEmail || null,
            name: trustedName || creatorName || null,
            employeeCode: normalizedCreatorCode
        };

        if (breakdownInput) {
            const breakdown = {};
            const serviceTotal = Number(breakdownInput.serviceTotal);
            const materialTotal = Number(breakdownInput.materialTotal);
            const subtotal = Number(breakdownInput.subtotal);
            const taxRate = Number(breakdownInput.taxRate);
            const taxAmount = Number(breakdownInput.taxAmount);
            const total = Number(breakdownInput.total);
            if (Number.isFinite(serviceTotal)) breakdown.serviceTotal = serviceTotal;
            if (Number.isFinite(materialTotal)) breakdown.materialTotal = materialTotal;
            if (Number.isFinite(subtotal)) breakdown.subtotal = subtotal;
            if (Number.isFinite(taxRate)) breakdown.taxRate = taxRate;
            if (Number.isFinite(taxAmount)) breakdown.taxAmount = taxAmount;
            if (Number.isFinite(total)) breakdown.total = total;
            if (Object.keys(breakdown).length > 0) {
                proposal.breakdown = breakdown;
            }
        }

        if (itemsInput && itemsInput.length > 0) {
            const cleanItems = itemsInput.slice(0, 200).map((item) => {
                const desc = typeof item.desc === 'string' ? item.desc.trim().slice(0, 200) : '';
                const typeRaw = typeof item.type === 'string' ? item.type.trim().toLowerCase() : 'servicio';
                const type = (typeRaw === 'material') ? 'material' : 'servicio';
                const qty = Number(item.qty);
                const price = Number(item.price);
                const amount = Number(item.amount);
                return {
                    desc,
                    type,
                    qty: Number.isFinite(qty) ? qty : 0,
                    price: Number.isFinite(price) ? price : 0,
                    amount: Number.isFinite(amount) ? amount : 0,
                };
            });
            proposal.items = cleanItems;
        }

        // Store secure metadata if available, otherwise legacy URL
        if (estimatePdf) {
            proposal.estimatePdf = estimatePdf;
            // Also store URL if available for backward compat, or derive it? 
            // Better to keep them separate. The UI will check estimatePdf first.
        } else if (estimatePdfUrl) {
            proposal.estimatePdfUrl = estimatePdfUrl;
        }

        tx.update(requestRef, {
            status: STATUS.NEGOCIANDO,
            proposal,
            updatedAt: serverTimestamp(),
        });
    });

    const fresh = await requestRef.get();
    logger.info('Proposal sent:', requestId, 'amount:', amount, 'hasPdf:', !!estimatePdfUrl);
    return mapDoc(fresh);
}

// ============================================================
// Accept Proposal (Client): NEGOCIANDO → EN_PROCESO
// ============================================================

async function acceptProposal(requestId, clientUid) {
    requireNonEmptyString(requestId, 'requestId');
    requireNonEmptyString(clientUid, 'clientUid');

    const requestRef = db.collection(REQUESTS_COLLECTION).doc(requestId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Solicitud no encontrada.');
        }

        const data = snap.data();

        // Authorization
        if (data.clientId !== clientUid) {
            throw appError(403, 'forbidden', 'Esta no es tu solicitud.');
        }

        // Must have proposal
        if (!data.proposal) {
            throw appError(400, 'no_proposal', 'No hay propuesta para aceptar.');
        }

        // Validate transition: NEGOCIANDO → EN_PROCESO
        assertTransition(data.status, STATUS.EN_PROCESO, 'client');

        tx.update(requestRef, {
            status: STATUS.EN_PROCESO,
            proposalAcceptedAt: serverTimestamp(),
            startedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    });

    const fresh = await requestRef.get();
    logger.info('Proposal accepted:', requestId);
    return mapDoc(fresh);
}

// ============================================================
// Reject Proposal (Client): NEGOCIANDO → EN_ESPERA
// ============================================================

async function rejectProposal(requestId, clientUid) {
    requireNonEmptyString(requestId, 'requestId');
    requireNonEmptyString(clientUid, 'clientUid');

    const requestRef = db.collection(REQUESTS_COLLECTION).doc(requestId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Solicitud no encontrada.');
        }

        const data = snap.data();

        // Authorization
        if (data.clientId !== clientUid) {
            throw appError(403, 'forbidden', 'Esta no es tu solicitud.');
        }

        // Validate transition: NEGOCIANDO → EN_ESPERA
        assertTransition(data.status, STATUS.EN_ESPERA, 'client');

        tx.update(requestRef, {
            status: STATUS.EN_ESPERA,
            assignedEmployeeId: null,
            assignedAt: null,
            employeeEmail: null,
            employeeName: null,
            proposal: null,
            updatedAt: serverTimestamp(),
        });
    });

    const fresh = await requestRef.get();
    logger.info('Proposal rejected:', requestId);
    return mapDoc(fresh);
}

// ============================================================
// Mark Finished (Employee): EN_PROCESO → ESPERANDO_CIERRE_CLIENTE
// ============================================================

async function markFinished(requestId, employeeUid) {
    requireNonEmptyString(requestId, 'requestId');
    requireNonEmptyString(employeeUid, 'employeeUid');

    const requestRef = db.collection(REQUESTS_COLLECTION).doc(requestId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Solicitud no encontrada.');
        }

        const data = snap.data();

        // Authorization
        if (data.assignedEmployeeId !== employeeUid) {
            throw appError(403, 'forbidden', 'No eres el empleado asignado.');
        }

        // Validate transition: EN_PROCESO → ESPERANDO_CIERRE_CLIENTE
        assertTransition(data.status, STATUS.ESPERANDO_CIERRE_CLIENTE, 'employee');

        tx.update(requestRef, {
            status: STATUS.ESPERANDO_CIERRE_CLIENTE,
            finishedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    });

    const fresh = await requestRef.get();
    logger.info('Marked finished:', requestId);
    return mapDoc(fresh);
}

// ============================================================
// Client Close: ESPERANDO_CIERRE_CLIENTE → ESPERANDO_COMPROBANTE_PAGO
// ============================================================

async function clientClose(requestId, clientUid, closeData = {}) {
    requireNonEmptyString(requestId, 'requestId');
    requireNonEmptyString(clientUid, 'clientUid');

    const finalAmount = Number(closeData.finalAmount);
    if (!Number.isFinite(finalAmount) || finalAmount < 0) {
        throw appError(400, 'invalid_input', 'Monto final inválido.');
    }

    const clientRating = Number(closeData.clientRating);
    if (!Number.isInteger(clientRating) || clientRating < 1 || clientRating > 5) {
        throw appError(400, 'invalid_input', 'Rating debe ser entre 1 y 5.');
    }

    const finalPhotoUrl = typeof closeData.finalPhotoUrl === 'string'
        ? closeData.finalPhotoUrl.trim()
        : null;

    const requestRef = db.collection(REQUESTS_COLLECTION).doc(requestId);
    let employeeId = null;

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Solicitud no encontrada.');
        }

        const data = snap.data();
        employeeId = data.assignedEmployeeId;

        // Authorization
        if (data.clientId !== clientUid) {
            throw appError(403, 'forbidden', 'Esta no es tu solicitud.');
        }

        // Validate transition: ESPERANDO_CIERRE_CLIENTE → ESPERANDO_COMPROBANTE_PAGO
        assertTransition(data.status, STATUS.ESPERANDO_COMPROBANTE_PAGO, 'client');

        tx.update(requestRef, {
            status: STATUS.ESPERANDO_COMPROBANTE_PAGO,
            finalAmount,
            clientRating,
            finalPhotoUrl,
            clientClosedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    });

    // Update employee profile (portfolio + rating) after successful transaction
    if (employeeId) {
        const employeeProfileService = require('./employee-profile.service');
        try {
            // Add photo to portfolio if provided
            if (finalPhotoUrl) {
                await employeeProfileService.addPortfolioPhoto(employeeId, finalPhotoUrl);
            }
            // Update employee rating
            await employeeProfileService.updateRating(employeeId, clientRating);
        } catch (err) {
            logger.error('Error updating employee profile:', err);
            // Don't fail the close if profile update fails
        }
    }

    const fresh = await requestRef.get();
    logger.info('Client closed:', requestId, 'rating:', clientRating, 'hasPhoto:', !!finalPhotoUrl);
    return mapDoc(fresh);
}

// ============================================================
// Submit Payment Proof: ESPERANDO_COMPROBANTE_PAGO → PAGO_PENDIENTE_REVISION
// ============================================================

async function submitPaymentProof(requestId, actorUid, proofUrl) {
    requireNonEmptyString(requestId, 'requestId');
    requireNonEmptyString(actorUid, 'actorUid');
    requireNonEmptyString(proofUrl, 'proofUrl');

    const requestRef = db.collection(REQUESTS_COLLECTION).doc(requestId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Solicitud no encontrada.');
        }

        const data = snap.data();

        // Authorization: client or assigned employee can submit proof
        const isClient = data.clientId === actorUid;
        const isEmployee = data.assignedEmployeeId === actorUid;
        if (!isClient && !isEmployee) {
            throw appError(403, 'forbidden', 'No autorizado.');
        }

        // Determine role for transition validation
        const role = isEmployee ? 'employee' : 'client';

        // Validate transition
        assertTransition(data.status, STATUS.PAGO_PENDIENTE_REVISION, role);

        tx.update(requestRef, {
            status: STATUS.PAGO_PENDIENTE_REVISION,
            paymentProofUrl: proofUrl,
            paymentProofAt: serverTimestamp(),
            paymentProofBy: actorUid, // Track who submitted
            paymentRejectedAt: null,
            paymentRejectedAtMs: null,
            paymentRejectedBy: null,
            paymentRejectionReason: null,
            updatedAt: serverTimestamp(),
        });
    });

    const fresh = await requestRef.get();
    logger.info('Payment proof submitted:', requestId);
    return mapDoc(fresh);
}

// ============================================================
// Approve Payment (Boss): PAGO_PENDIENTE_REVISION → COMPLETADO
// ============================================================

async function approvePayment(requestId, bossUid) {
    requireNonEmptyString(requestId, 'requestId');
    requireNonEmptyString(bossUid, 'bossUid');

    const requestRef = db.collection(REQUESTS_COLLECTION).doc(requestId);
    let requestData = null;

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Solicitud no encontrada.');
        }

        requestData = snap.data();

        // Validate transition: PAGO_PENDIENTE_REVISION → COMPLETADO
        assertTransition(requestData.status, STATUS.COMPLETADO, 'boss');

        tx.update(requestRef, {
            status: STATUS.COMPLETADO,
            bossApprovedAt: serverTimestamp(),
            bossApprovedBy: bossUid,
            updatedAt: serverTimestamp(),
        });
    });

    // Record earnings (20% commission) after successful transaction
    if (requestData && requestData.finalAmount) {
        const earningsService = require('./earnings.service');
        try {
            await earningsService.recordEarning({
                requestId,
                finalAmount: requestData.finalAmount,
                employeeId: requestData.assignedEmployeeId,
                employeeName: requestData.employeeName,
                employeeEmail: requestData.employeeEmail,
                description: requestData.description,
                address: requestData.address
            });
        } catch (err) {
            logger.error('Error recording earning:', err);
            // Don't fail the approval if earning recording fails
        }
    }

    const fresh = await requestRef.get();
    logger.info('Payment approved:', requestId, 'by boss:', bossUid);
    return mapDoc(fresh);
}

async function rejectPayment(requestId, bossUid, reason = '') {
    requireNonEmptyString(requestId, 'requestId');
    requireNonEmptyString(bossUid, 'bossUid');
    const cleanReason = typeof reason === 'string' ? reason.trim().slice(0, 300) : '';

    const requestRef = db.collection(REQUESTS_COLLECTION).doc(requestId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
            throw appError(404, 'not_found', 'Solicitud no encontrada.');
        }

        const requestData = snap.data();
        assertTransition(requestData.status, STATUS.ESPERANDO_COMPROBANTE_PAGO, 'boss');

        tx.update(requestRef, {
            status: STATUS.ESPERANDO_COMPROBANTE_PAGO,
            paymentProofUrl: null,
            paymentProofAt: null,
            paymentProofBy: null,
            paymentRejectedAt: serverTimestamp(),
            paymentRejectedAtMs: Date.now(),
            paymentRejectedBy: bossUid,
            paymentRejectionReason: cleanReason || null,
            updatedAt: serverTimestamp(),
        });
    });

    const fresh = await requestRef.get();
    logger.info('Payment rejected:', requestId, 'by boss:', bossUid);
    return mapDoc(fresh);
}

// ============================================================
// Boss: List All Requests
// ============================================================

async function listAllRequestsForBoss(options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
    const statusFilter = options.status;

    let query = db.collection(REQUESTS_COLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(limit);

    if (statusFilter && typeof statusFilter === 'string') {
        query = db.collection(REQUESTS_COLLECTION)
            .where('status', '==', statusFilter)
            .orderBy('createdAt', 'desc')
            .limit(limit);
    }

    const snap = await query.get();
    return snap.docs.map(mapDoc);
}

// ============================================================
// Boss: List Pending Payments
// ============================================================

async function listPendingPayments(options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 100);

    const snap = await db.collection(REQUESTS_COLLECTION)
        .where('status', '==', STATUS.PAGO_PENDIENTE_REVISION)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

    return snap.docs.map(mapDoc);
}

async function listBossReviewQueue(options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || 200, 1), 500);

    const [requestRows, emergencySnap] = await Promise.all([
        listPendingPayments({ limit: Math.max(limit * 2, 200) }),
        db.collection(EMERGENCY_COLLECTION)
            .where('status', '==', 'payment_pending_review')
            .get(),
    ]);

    const emergencyRows = emergencySnap.docs.map(mapEmergencyDoc);

    const normalizedRequestRows = requestRows.map((req) => {
        const amount = Number(req?.finalAmount);
        const proofAtMs = toMillis(req?.paymentProofAt) || toMillis(req?.updatedAt) || toMillis(req?.createdAt);

        return {
            sourceType: 'request',
            sourceLabel: 'Solicitud',
            recordId: req?.id || '',
            queueId: `request:${req?.id || ''}`,
            status: req?.status || STATUS.PAGO_PENDIENTE_REVISION,
            amount: Number.isFinite(amount) ? amount : 0,
            paymentProofAt: req?.paymentProofAt || req?.updatedAt || req?.createdAt || null,
            paymentProofAtMs: proofAtMs,
            paymentProofUrl: req?.paymentProofUrl || null,
            employeeId: req?.assignedEmployeeId || null,
            employeeName: req?.employeeName || req?.employeeEmail || null,
            employeeEmail: req?.employeeEmail || null,
            clientId: req?.clientId || null,
            clientName: req?.clientNickname || req?.clientEmail || null,
            clientEmail: req?.clientEmail || null,
            description: req?.description || null,
            address: req?.address || null,
            createdAt: req?.createdAt || null,
            updatedAt: req?.updatedAt || null,
        };
    });

    const normalizedEmergencyRows = emergencyRows.map((call) => {
        const amount = Number(call?.finalAmount ?? call?.quotedAmount);
        const proofAtMs = Number(call?.paymentProofAtMs || call?.updatedAtMs || call?.createdAtMs || 0);

        return {
            sourceType: 'emergency',
            sourceLabel: 'Emergencia',
            recordId: call?.id || '',
            queueId: `emergency:${call?.id || ''}`,
            status: call?.status || 'payment_pending_review',
            amount: Number.isFinite(amount) ? amount : 0,
            paymentProofAt: call?.paymentProofAt || call?.updatedAt || call?.createdAt || null,
            paymentProofAtMs: proofAtMs,
            paymentProofUrl: call?.paymentProofUrl || null,
            employeeId: call?.assignedEmployeeId || null,
            employeeName: call?.assignedEmployeeName || call?.assignedEmployeeEmail || null,
            employeeEmail: call?.assignedEmployeeEmail || null,
            clientId: call?.clientId || null,
            clientName: call?.clientName || call?.clientEmail || null,
            clientEmail: call?.clientEmail || null,
            description: call?.description || call?.issue || null,
            address: call?.address || call?.location || null,
            createdAt: call?.createdAt || null,
            updatedAt: call?.updatedAt || null,
        };
    });

    return [...normalizedRequestRows, ...normalizedEmergencyRows]
        .sort((a, b) => Number(b.paymentProofAtMs || 0) - Number(a.paymentProofAtMs || 0))
        .slice(0, limit);
}

// ============================================================
// Chat Functions (REST-based)
// ============================================================

const CHAT_STATUSES = [
    STATUS.ASIGNADO,
    STATUS.NEGOCIANDO,
    STATUS.EN_PROCESO,
    STATUS.ESPERANDO_CIERRE_CLIENTE,
];
const MAX_CLIENT_CHAT_ATTACHMENTS = 3;

/**
 * Check if user can access chat for this request.
 */
function canAccessChat(request, userUid, userRole) {
    // Boss can always access
    if (userRole === 'boss') return true;
    // Client owner can access
    if (request.clientId === userUid) return true;
    // Assigned employee can access
    if (request.assignedEmployeeId === userUid) return true;
    return false;
}

/**
 * Check if chat is allowed based on status.
 */
function isChatAllowed(status) {
    return CHAT_STATUSES.includes(status);
}

/**
 * List chat messages for a request.
 */
async function listChatMessages(requestId, userUid, userRole, options = {}) {
    requireNonEmptyString(requestId, 'requestId');
    requireNonEmptyString(userUid, 'userUid');

    // Get request to check access
    const requestDoc = await db.collection(REQUESTS_COLLECTION).doc(requestId).get();
    if (!requestDoc.exists) {
        throw appError(404, 'not_found', 'Solicitud no encontrada.');
    }

    const request = requestDoc.data();
    if (!canAccessChat(request, userUid, userRole)) {
        throw appError(403, 'forbidden', 'No tienes acceso al chat de esta solicitud.');
    }

    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 100);

    const snap = await db.collection(REQUESTS_COLLECTION)
        .doc(requestId)
        .collection('chat')
        .orderBy('createdAt', 'asc')
        .limit(limit)
        .get();

    return snap.docs
        .map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                text: data.text || '',
                senderId: data.senderId || '',
                senderRole: data.senderRole || '',
                senderName: data.senderName || '',
                isInternal: !!data.isInternal, // Expose flag
                attachments: data.attachments || [],
                createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
            };
        })
        .filter(msg => {
            // Clients cannot see internal messages
            if (userRole === 'client' && msg.isInternal) return false;
            return true;
        });
}

/**
 * Send a chat message.
 */
async function sendChatMessage(requestId, userUid, userRole, text, senderName = '', isInternal = false, attachments = []) {
    requireNonEmptyString(requestId, 'requestId');
    requireNonEmptyString(userUid, 'userUid');
    const cleanText = typeof text === 'string' ? text.trim() : '';
    const cleanAttachments = Array.isArray(attachments)
        ? attachments.filter((item) => typeof item === 'string' && item.trim() !== '')
        : [];

    if (!cleanText && cleanAttachments.length === 0) {
        throw appError(400, 'invalid_input', 'text o adjuntos son requeridos.');
    }

    // Get request to check access and status
    const requestDoc = await db.collection(REQUESTS_COLLECTION).doc(requestId).get();
    if (!requestDoc.exists) {
        throw appError(404, 'not_found', 'Solicitud no encontrada.');
    }

    const request = requestDoc.data();
    if (!canAccessChat(request, userUid, userRole)) {
        throw appError(403, 'forbidden', 'No tienes acceso al chat de esta solicitud.');
    }

    const allowBossInternal = userRole === 'boss' && !!isInternal;
    if (!isChatAllowed(request.status) && !allowBossInternal) {
        throw appError(400, 'chat_not_allowed', `No se puede chatear en estado ${request.status}.`);
    }

    // Security: Clients cannot send internal messages
    if (userRole === 'client' && isInternal) {
        throw appError(403, 'forbidden', 'Clientes no pueden enviar mensajes internos.');
    }

    // Limit total attachments for client across the whole chat
    if (userRole === 'client' && cleanAttachments.length > 0) {
        const snap = await db.collection(REQUESTS_COLLECTION)
            .doc(requestId)
            .collection('chat')
            .where('senderId', '==', userUid)
            .get();

        let used = 0;
        snap.forEach((doc) => {
            const data = doc.data() || {};
            if (Array.isArray(data.attachments)) used += data.attachments.length;
        });

        const remaining = MAX_CLIENT_CHAT_ATTACHMENTS - used;
        if (remaining <= 0) {
            throw appError(400, 'invalid_input', `Ya alcanzaste el máximo de ${MAX_CLIENT_CHAT_ATTACHMENTS} fotos en el chat.`);
        }
        if (cleanAttachments.length > remaining) {
            throw appError(400, 'invalid_input', `Solo puedes enviar ${remaining} foto(s) más en este chat.`);
        }
    }

    const msgRef = db.collection(REQUESTS_COLLECTION)
        .doc(requestId)
        .collection('chat')
        .doc();

    const msgData = {
        text: cleanText.substring(0, 1000), // Limit 1000 chars
        attachments: cleanAttachments.slice(0, 3), // Limit 3 photos
        senderId: userUid,
        senderRole: userRole,
        senderName: senderName || '',
        isInternal: !!isInternal,
        createdAt: serverTimestamp(),
    };

    await msgRef.set(msgData);

    return {
        id: msgRef.id,
        ...msgData,
        createdAt: new Date().toISOString(), // Return immediate timestamp
    };
}

// ============================================================
// Exports
// ============================================================

module.exports = {
    // Create
    createRequest,
    createEmergencyCall,

    // List
    listAvailableRequests,
    listClientRequests,
    listEmployeeRequests,
    getRequest,
    getEmergencyCall,
    listEmergencyCalls,

    // Employee: active job check
    hasActiveJob,
    getActiveJobForEmployee,

    // Claim flow
    claimRequest,
    assignRequestByBoss,
    releaseClaim,
    releaseRequestByBoss,

    // Cancel
    cancelRequest,
    acceptEmergencyCall,
    resolveEmergencyCall,
    clientCloseEmergencyCall,
    submitEmergencyPaymentProof,
    approveEmergencyPayment,
    rejectEmergencyPayment,
    deleteEmergencyCall,
    updateEmergencyLocation,

    // Proposal flow
    allocateNextQuoteNumber,
    sendProposal,
    acceptProposal,
    rejectProposal,
    getProposal, // Exported for controller usage

    // Work completion
    markFinished,
    clientClose,

    // Payment flow
    submitPaymentProof,
    approvePayment,
    rejectPayment,

    // Boss
    listAllRequestsForBoss,
    listPendingPayments,
    listBossReviewQueue,

    // Chat
    listChatMessages,
    sendChatMessage,
    listEmergencyChatMessages,
    sendEmergencyChatMessage,
};

