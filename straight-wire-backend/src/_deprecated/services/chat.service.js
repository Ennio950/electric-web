'use strict';

/**
 * Chat Service
 * 
 * Handles messages for marketplace requests with rate-limiting.
 * Rate limit: 1 message per 3 seconds per user per request.
 * Uses dedicated collection: chatRateLimits/{requestId}_{uid}
 */

const { admin, db } = require('../firebase');
const { appError } = require('../utils/errors');
const { CHAT_ALLOWED_STATUSES } = require('../marketplace.constants');

const REQUESTS_COLLECTION = 'requests';
const MESSAGES_SUBCOLLECTION = 'messages';
const RATE_LIMITS_COLLECTION = 'chatRateLimits';

const RATE_LIMIT_MS = 3000; // 3 seconds

// ============================================================
// Helpers
// ============================================================

function serverTimestamp() {
    return admin.firestore.FieldValue.serverTimestamp();
}

function requireNonEmptyString(value, label) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw appError(400, 'invalid_input', `${label} is required.`);
    }
    return value.trim();
}

function getRateLimitDocId(requestId, uid) {
    return `${requestId}_${uid}`;
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

// ============================================================
// Rate Limit Check
// ============================================================

/**
 * Checks if a user can send a message (rate limit).
 * @param {string} requestId 
 * @param {string} uid 
 * @returns {Promise<{canSend: boolean, waitMs: number}>}
 */
async function checkRateLimit(requestId, uid) {
    const docId = getRateLimitDocId(requestId, uid);
    const doc = await db.collection(RATE_LIMITS_COLLECTION).doc(docId).get();

    if (!doc.exists) {
        return { canSend: true, waitMs: 0 };
    }

    const data = doc.data();
    const lastAt = data.lastAt;

    if (!lastAt || typeof lastAt.toMillis !== 'function') {
        return { canSend: true, waitMs: 0 };
    }

    const elapsed = Date.now() - lastAt.toMillis();
    if (elapsed >= RATE_LIMIT_MS) {
        return { canSend: true, waitMs: 0 };
    }

    return {
        canSend: false,
        waitMs: RATE_LIMIT_MS - elapsed,
    };
}

// ============================================================
// Send Message (Transactional with rate-limit update)
// ============================================================

/**
 * Sends a message with rate-limit enforcement.
 * 
 * @param {string} requestId 
 * @param {string} senderUid 
 * @param {string} senderRole - 'client' | 'employee'
 * @param {string} text 
 */
async function sendMessage(requestId, senderUid, senderRole, text) {
    requireNonEmptyString(requestId, 'requestId');
    requireNonEmptyString(senderUid, 'senderUid');
    requireNonEmptyString(senderRole, 'senderRole');
    requireNonEmptyString(text, 'text');

    const trimmedText = text.trim();
    if (trimmedText.length > 2000) {
        throw appError(400, 'message_too_long', 'Message exceeds 2000 characters.');
    }

    const requestRef = db.collection(REQUESTS_COLLECTION).doc(requestId);
    const rateLimitDocId = getRateLimitDocId(requestId, senderUid);
    const rateLimitRef = db.collection(RATE_LIMITS_COLLECTION).doc(rateLimitDocId);

    let messageId;

    await db.runTransaction(async (tx) => {
        // 1. Verify request exists and chat is allowed
        const requestSnap = await tx.get(requestRef);
        if (!requestSnap.exists) {
            throw appError(404, 'not_found', 'Request not found.');
        }

        const requestData = requestSnap.data();

        // Verify chat is allowed in current status
        if (!CHAT_ALLOWED_STATUSES.includes(requestData.status)) {
            throw appError(400, 'chat_not_allowed',
                `Chat is not allowed in status "${requestData.status}".`);
        }

        // Verify sender is participant
        const isClient = requestData.clientId === senderUid;
        const isEmployee = requestData.claimedBy === senderUid;
        if (!isClient && !isEmployee) {
            throw appError(403, 'forbidden', 'You are not a participant in this request.');
        }

        // 2. Check rate limit
        const rateLimitSnap = await tx.get(rateLimitRef);
        if (rateLimitSnap.exists) {
            const data = rateLimitSnap.data();
            const lastAt = data.lastAt;
            if (lastAt && typeof lastAt.toMillis === 'function') {
                const elapsed = Date.now() - lastAt.toMillis();
                if (elapsed < RATE_LIMIT_MS) {
                    const waitSec = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
                    throw appError(429, 'rate_limited',
                        `Please wait ${waitSec} seconds before sending another message.`);
                }
            }
        }

        // 3. Create message
        const messageRef = requestRef.collection(MESSAGES_SUBCOLLECTION).doc();
        messageId = messageRef.id;

        tx.set(messageRef, {
            senderId: senderUid,
            senderRole: senderRole,
            text: trimmedText,
            createdAt: serverTimestamp(),
        });

        // 4. Update rate limit
        tx.set(rateLimitRef, {
            lastAt: serverTimestamp(),
        });

        // 5. Update request's updatedAt
        tx.update(requestRef, {
            updatedAt: serverTimestamp(),
        });
    });

    // Fetch the created message
    const messageDoc = await requestRef.collection(MESSAGES_SUBCOLLECTION).doc(messageId).get();
    return mapDoc(messageDoc);
}

// ============================================================
// List Messages
// ============================================================

/**
 * Lists messages for a request.
 * 
 * @param {string} requestId 
 * @param {object} options 
 */
async function listMessages(requestId, options = {}) {
    requireNonEmptyString(requestId, 'requestId');

    const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 500);
    const afterId = options.afterId || null;

    const messagesRef = db.collection(REQUESTS_COLLECTION)
        .doc(requestId)
        .collection(MESSAGES_SUBCOLLECTION);

    let query = messagesRef.orderBy('createdAt', 'asc');

    if (afterId) {
        const afterDoc = await messagesRef.doc(afterId).get();
        if (afterDoc.exists) {
            query = query.startAfter(afterDoc);
        }
    }

    const snap = await query.limit(limit).get();
    return snap.docs.map(mapDoc);
}

module.exports = {
    checkRateLimit,
    sendMessage,
    listMessages,
    RATE_LIMIT_MS,
};
