'use strict';

function normalizeRole(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function canDeleteEmergencyCall(call, actor = {}) {
    if (!call || typeof call !== 'object') return false;

    const actorUid = typeof actor.uid === 'string' ? actor.uid.trim() : '';
    const actorRole = normalizeRole(actor.role);
    if (!actorUid || !actorRole) return false;

    if (actorRole === 'boss') return true;

    return actorRole === 'employee'
        && typeof call.assignedEmployeeId === 'string'
        && call.assignedEmployeeId.trim() === actorUid;
}

module.exports = {
    canDeleteEmergencyCall,
};
