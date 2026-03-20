/**
 * Marketplace API Module (Production)
 * 
 * Frontend API functions for the technician marketplace.
 * All functions use apiFetch() which handles authentication automatically.
 */

import { apiFetch } from './api.js';

const BASE = '/api/marketplace';

// ============================================================
// CANONICAL STATUS VALUES (match backend exactly)
// ============================================================
export const STATUS = Object.freeze({
    EN_ESPERA: 'EN_ESPERA',
    ASIGNADO: 'ASIGNADO',
    CANCELADO: 'CANCELADO',
    NEGOCIANDO: 'NEGOCIANDO',
    EN_PROCESO: 'EN_PROCESO',
    ESPERANDO_CIERRE_CLIENTE: 'ESPERANDO_CIERRE_CLIENTE',
    ESPERANDO_COMPROBANTE_PAGO: 'ESPERANDO_COMPROBANTE_PAGO',
    PAGO_PENDIENTE_REVISION: 'PAGO_PENDIENTE_REVISION',
    COMPLETADO: 'COMPLETADO',
});

// Human-readable status labels
export const STATUS_LABELS = Object.freeze({
    [STATUS.EN_ESPERA]: 'En espera',
    [STATUS.ASIGNADO]: 'Asignado',
    [STATUS.CANCELADO]: 'Cancelado',
    [STATUS.NEGOCIANDO]: 'Negociando',
    [STATUS.EN_PROCESO]: 'En proceso',
    [STATUS.ESPERANDO_CIERRE_CLIENTE]: 'Esperando cierre',
    [STATUS.ESPERANDO_COMPROBANTE_PAGO]: 'Esperando comprobante',
    [STATUS.PAGO_PENDIENTE_REVISION]: 'Pago pendiente revisión',
    [STATUS.COMPLETADO]: 'Completado',
});

// Badge colors for UI
export const STATUS_COLORS = Object.freeze({
    [STATUS.EN_ESPERA]: 'warning',
    [STATUS.ASIGNADO]: 'info',
    [STATUS.CANCELADO]: 'danger',
    [STATUS.NEGOCIANDO]: 'primary',
    [STATUS.EN_PROCESO]: 'primary',
    [STATUS.ESPERANDO_CIERRE_CLIENTE]: 'warning',
    [STATUS.ESPERANDO_COMPROBANTE_PAGO]: 'warning',
    [STATUS.PAGO_PENDIENTE_REVISION]: 'info',
    [STATUS.COMPLETADO]: 'success',
});

// ============================================================
// Client Functions
// ============================================================

/**
 * Create a new service request.
 * @param {object} data - { description, address, category, photoUrl }
 */
export async function createRequest(data) {
    return apiFetch(`${BASE}/requests`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * List client's own requests.
 * @param {object} options - { limit }
 */
export async function listClientRequests(options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit);
    const qs = params.toString();
    return apiFetch(`${BASE}/requests${qs ? '?' + qs : ''}`);
}

/**
 * Get a single request by ID.
 */
export async function getRequest(id) {
    return apiFetch(`${BASE}/requests/${id}`);
}

/**
 * Cancel a request (only EN_ESPERA).
 */
export async function cancelRequest(id) {
    return apiFetch(`${BASE}/requests/${id}`, { method: 'DELETE' });
}

/**
 * Accept a proposal (NEGOCIANDO → EN_PROCESO).
 */
export async function acceptProposal(id) {
    return apiFetch(`${BASE}/requests/${id}/accept-proposal`, { method: 'POST' });
}

/**
 * Reject a proposal (NEGOCIANDO → EN_ESPERA).
 */
export async function rejectProposal(id) {
    return apiFetch(`${BASE}/requests/${id}/reject-proposal`, { method: 'POST' });
}

/**
 * Close work (ESPERANDO_CIERRE_CLIENTE → ESPERANDO_COMPROBANTE_PAGO).
 * @param {string} id
 * @param {object} data - { finalAmount, clientRating, finalPhotoUrl }
 */
export async function clientClose(id, data) {
    return apiFetch(`${BASE}/requests/${id}/close`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * Submit payment proof (ESPERANDO_COMPROBANTE_PAGO → PAGO_PENDIENTE_REVISION).
 */
export async function submitPaymentProof(id, proofUrl) {
    return apiFetch(`${BASE}/requests/${id}/payment-proof`, {
        method: 'POST',
        body: JSON.stringify({ proofUrl }),
    });
}

/**
 * Re-send boss WhatsApp notification for a payment proof already uploaded.
 */
export async function notifyBossPaymentReview(id) {
    return apiFetch(`${BASE}/requests/${id}/notify-boss-payment`, {
        method: 'POST',
    });
}

// ============================================================
// Employee Functions
// ============================================================

/**
 * List available requests (EN_ESPERA).
 */
export async function listAvailableRequests(options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit);
    const qs = params.toString();
    return apiFetch(`${BASE}/requests/available${qs ? '?' + qs : ''}`);
}

/**
 * List employee's assigned requests.
 */
export async function listMyRequests(options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit);
    const qs = params.toString();
    return apiFetch(`${BASE}/employee/my-requests${qs ? '?' + qs : ''}`);
}

/**
 * Get current active job.
 */
export async function getActiveJob() {
    return apiFetch(`${BASE}/employee/active-job`);
}

/**
 * Claim a request (EN_ESPERA → ASIGNADO).
 */
export async function claimRequest(id) {
    return apiFetch(`${BASE}/requests/${id}/claim`, { method: 'POST' });
}

/**
 * Release a claim (ASIGNADO → EN_ESPERA).
 */
export async function releaseClaim(id) {
    return apiFetch(`${BASE}/requests/${id}/release`, { method: 'POST' });
}

/**
 * Send a proposal (ASIGNADO → NEGOCIANDO).
 * @param {string} id
 * @param {object} data - { amount, notes }
 */
export async function sendProposal(id, data) {
    return apiFetch(`${BASE}/requests/${id}/proposal`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * Mark work finished (EN_PROCESO → ESPERANDO_CIERRE_CLIENTE).
 */
export async function markFinished(id) {
    return apiFetch(`${BASE}/requests/${id}/finish`, { method: 'POST' });
}

/**
 * Re-send boss WhatsApp notification for an emergency payment proof already uploaded.
 */
export async function notifyBossEmergencyPaymentReview(id) {
    return apiFetch(`${BASE}/emergency-calls/${id}/notify-boss-payment`, {
        method: 'POST',
    });
}

// ============================================================
// Boss Functions
// ============================================================

/**
 * List all requests (boss only).
 */
export async function listAllRequests(options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit);
    if (options.status) params.set('status', options.status);
    const qs = params.toString();
    return apiFetch(`${BASE}/boss/requests${qs ? '?' + qs : ''}`);
}

/**
 * List pending payment approvals.
 */
export async function listPendingPayments(options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit);
    const qs = params.toString();
    return apiFetch(`${BASE}/boss/payments/pending${qs ? '?' + qs : ''}`);
}

/**
 * Approve payment (PAGO_PENDIENTE_REVISION → COMPLETADO).
 */
export async function approvePayment(id) {
    return apiFetch(`${BASE}/requests/${id}/approve-payment`, { method: 'POST' });
}
