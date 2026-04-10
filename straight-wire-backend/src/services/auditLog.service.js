'use strict';

/**
 * Audit Log Service
 * 
 * Logs critical actions for accountability and compliance.
 * Collection: auditLogs/{id}
 */

const { admin, db } = require('../firebase');

const AUDIT_LOGS_COLLECTION = 'auditLogs';

function serverTimestamp() {
    return admin.firestore.FieldValue.serverTimestamp();
}

/**
 * Logs an action to the audit log.
 * 
 * @param {object} entry
 * @param {string} entry.actorId - UID of who performed the action
 * @param {string} entry.role - Role of the actor
 * @param {string} entry.action - Action type (e.g., 'override_close', 'approve_payment')
 * @param {string} entry.targetId - ID of the affected entity (e.g., requestId)
 * @param {object} [entry.meta] - Additional metadata
 */
async function logAction(entry) {
    if (!entry || typeof entry !== 'object') {
        console.error('[auditLog] Invalid entry');
        return null;
    }

    const logRef = db.collection(AUDIT_LOGS_COLLECTION).doc();

    const logData = {
        actorId: entry.actorId || null,
        role: entry.role || null,
        action: entry.action || 'unknown',
        targetId: entry.targetId || null,
        meta: entry.meta || {},
        createdAt: serverTimestamp(),
    };

    await logRef.set(logData);

    return { id: logRef.id, ...logData };
}

/**
 * Lists audit logs with optional filtering.
 */
async function listLogs(options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);

    let query = db.collection(AUDIT_LOGS_COLLECTION)
        .orderBy('createdAt', 'desc');

    if (options.actorId) {
        query = query.where('actorId', '==', options.actorId);
    }

    if (options.targetId) {
        query = query.where('targetId', '==', options.targetId);
    }

    if (options.action) {
        query = query.where('action', '==', options.action);
    }

    const snap = await query.limit(limit).get();

    return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
    }));
}

module.exports = {
    logAction,
    listLogs,
};
