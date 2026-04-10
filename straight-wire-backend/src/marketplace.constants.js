'use strict';

/**
 * Marketplace State Machine Constants (Production)
 * 
 * CANONICAL 9-state machine with strict transitions.
 * All status values are in UPPERCASE Spanish - use EXACTLY these values.
 */

// ============================================================
// CANONICAL STATUS VALUES (use EXACTLY these strings)
// ============================================================
const STATUS = Object.freeze({
  EN_ESPERA: 'EN_ESPERA',                                   // 1. Awaiting employee claim
  ASIGNADO: 'ASIGNADO',                                     // 2. Employee claimed
  CANCELADO: 'CANCELADO',                                   // 3. Client cancelled
  NEGOCIANDO: 'NEGOCIANDO',                                 // 4. Proposal sent
  EN_PROCESO: 'EN_PROCESO',                                 // 5. Work in progress
  ESPERANDO_CIERRE_CLIENTE: 'ESPERANDO_CIERRE_CLIENTE',     // 6. Employee finished
  ESPERANDO_COMPROBANTE_PAGO: 'ESPERANDO_COMPROBANTE_PAGO', // 7. Awaiting payment proof
  PAGO_PENDIENTE_REVISION: 'PAGO_PENDIENTE_REVISION',       // 8. Boss review pending
  COMPLETADO: 'COMPLETADO',                                 // 9. Done
});

// ============================================================
// VALID TRANSITIONS (current -> allowed next states)
// ============================================================
const TRANSITIONS = Object.freeze({
  [STATUS.EN_ESPERA]: [STATUS.ASIGNADO, STATUS.CANCELADO],
  [STATUS.ASIGNADO]: [STATUS.NEGOCIANDO, STATUS.EN_ESPERA], // EN_ESPERA = release
  [STATUS.NEGOCIANDO]: [STATUS.EN_PROCESO, STATUS.EN_ESPERA], // EN_ESPERA = reject proposal
  [STATUS.EN_PROCESO]: [STATUS.ESPERANDO_CIERRE_CLIENTE],
  [STATUS.ESPERANDO_CIERRE_CLIENTE]: [STATUS.ESPERANDO_COMPROBANTE_PAGO],
  [STATUS.ESPERANDO_COMPROBANTE_PAGO]: [STATUS.PAGO_PENDIENTE_REVISION],
  [STATUS.PAGO_PENDIENTE_REVISION]: [STATUS.COMPLETADO, STATUS.ESPERANDO_COMPROBANTE_PAGO],
  // Terminal states
  [STATUS.COMPLETADO]: [],
  [STATUS.CANCELADO]: [],
});

// ============================================================
// ROLE-BASED TRANSITION RULES
// ============================================================
const ROLE_TRANSITIONS = Object.freeze({
  client: {
    // Client can: create, cancel (EN_ESPERA only), reject proposal, close, submit proof
    [STATUS.EN_ESPERA]: [STATUS.CANCELADO],
    [STATUS.NEGOCIANDO]: [STATUS.EN_PROCESO, STATUS.EN_ESPERA], // accept or reject
    [STATUS.ESPERANDO_CIERRE_CLIENTE]: [STATUS.ESPERANDO_COMPROBANTE_PAGO],
    [STATUS.ESPERANDO_COMPROBANTE_PAGO]: [STATUS.PAGO_PENDIENTE_REVISION],
  },
  employee: {
    // Employee can: claim, release, send proposal, finish, submit payment proof
    [STATUS.EN_ESPERA]: [STATUS.ASIGNADO], // claim
    [STATUS.ASIGNADO]: [STATUS.NEGOCIANDO, STATUS.EN_ESPERA], // proposal or release
    [STATUS.EN_PROCESO]: [STATUS.ESPERANDO_CIERRE_CLIENTE], // finish
    [STATUS.ESPERANDO_COMPROBANTE_PAGO]: [STATUS.PAGO_PENDIENTE_REVISION], // submit proof
  },
  boss: {
    // Boss can: approve payment, override (future)
    [STATUS.PAGO_PENDIENTE_REVISION]: [STATUS.COMPLETADO, STATUS.ESPERANDO_COMPROBANTE_PAGO],
  },
});

// ============================================================
// HELPER SETS
// ============================================================

/** Statuses that count as "active" for an employee (blocks claiming another job) */
const EMPLOYEE_ACTIVE_STATUSES = Object.freeze([
  STATUS.ASIGNADO,
  STATUS.NEGOCIANDO,
  STATUS.EN_PROCESO,
  STATUS.ESPERANDO_CIERRE_CLIENTE,
  STATUS.ESPERANDO_COMPROBANTE_PAGO,
  STATUS.PAGO_PENDIENTE_REVISION,
]);

/** Statuses visible to employees in "available" queue */
const AVAILABLE_STATUSES = Object.freeze([STATUS.EN_ESPERA]);

/** Statuses that allow chat */
const CHAT_ALLOWED_STATUSES = Object.freeze([
  STATUS.ASIGNADO,
  STATUS.NEGOCIANDO,
  STATUS.EN_PROCESO,
  STATUS.ESPERANDO_CIERRE_CLIENTE,
]);

/** Terminal statuses (no further transitions) */
const TERMINAL_STATUSES = Object.freeze([
  STATUS.COMPLETADO,
  STATUS.CANCELADO,
]);

// ============================================================
// TRANSITION VALIDATION
// ============================================================

/**
 * Check if a transition is valid (ignoring role).
 * @param {string} currentStatus 
 * @param {string} nextStatus 
 * @returns {boolean}
 */
function isValidTransition(currentStatus, nextStatus) {
  const allowed = TRANSITIONS[currentStatus];
  if (!Array.isArray(allowed)) return false;
  return allowed.includes(nextStatus);
}

/**
 * Assert that a transition is valid for the given role.
 * Throws an error with code 'invalid_transition' if not allowed.
 * 
 * @param {string} currentStatus - Current request status
 * @param {string} nextStatus - Desired next status
 * @param {string} actorRole - 'client' | 'employee' | 'boss'
 * @param {object} [context] - Optional context for error messages
 * @throws {Error} with status=409 and code='invalid_transition'
 */
function assertTransition(currentStatus, nextStatus, actorRole, context = {}) {
  // First check: is the transition valid at all?
  if (!isValidTransition(currentStatus, nextStatus)) {
    const err = new Error(
      `Transición inválida: ${currentStatus} → ${nextStatus}. ` +
      `Transiciones permitidas desde ${currentStatus}: ${(TRANSITIONS[currentStatus] || []).join(', ') || 'ninguna'}`
    );
    err.status = 409;
    err.code = 'invalid_transition';
    err.details = { currentStatus, nextStatus, allowed: TRANSITIONS[currentStatus] || [] };
    throw err;
  }

  // Second check: is the role allowed to make this transition?
  const roleAllowed = ROLE_TRANSITIONS[actorRole];
  if (!roleAllowed) {
    const err = new Error(`Rol desconocido: ${actorRole}`);
    err.status = 403;
    err.code = 'forbidden';
    throw err;
  }

  const roleStatusAllowed = roleAllowed[currentStatus];
  if (!Array.isArray(roleStatusAllowed) || !roleStatusAllowed.includes(nextStatus)) {
    const err = new Error(
      `El rol '${actorRole}' no puede hacer la transición ${currentStatus} → ${nextStatus}. ` +
      `Transiciones permitidas para ${actorRole} desde ${currentStatus}: ${(roleStatusAllowed || []).join(', ') || 'ninguna'}`
    );
    err.status = 403;
    err.code = 'forbidden';
    err.details = { currentStatus, nextStatus, role: actorRole, roleAllowed: roleStatusAllowed || [] };
    throw err;
  }
}

/**
 * Validate that a status value is one of the canonical statuses.
 * @param {string} status 
 * @returns {boolean}
 */
function isValidStatus(status) {
  return Object.values(STATUS).includes(status);
}

// ============================================================
// COMMISSION & OTHER CONSTANTS
// ============================================================
const COMMISSION_RATE = 0.20; // 20% boss commission

// ============================================================
// EXPORTS
// ============================================================
module.exports = Object.freeze({
  STATUS,
  TRANSITIONS,
  ROLE_TRANSITIONS,
  EMPLOYEE_ACTIVE_STATUSES,
  AVAILABLE_STATUSES,
  CHAT_ALLOWED_STATUSES,
  TERMINAL_STATUSES,
  COMMISSION_RATE,
  isValidTransition,
  assertTransition,
  isValidStatus,
});
