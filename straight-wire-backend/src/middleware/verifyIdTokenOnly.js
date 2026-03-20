'use strict';

/**
 * verifyIdTokenOnly middleware
 * 
 * Verifies Firebase ID Token ONLY - does NOT check role/Firestore.
 * Use this for endpoints that need authentication but DON'T require an existing user profile.
 * 
 * Key difference from verifyFirebaseToken:
 * - verifyFirebaseToken: validates token + checks role in Firestore (returns 403 if no role)
 * - verifyIdTokenOnly: validates token ONLY (sets req.user but doesn't require role)
 * 
 * Error contract:
 * - 401 when token is missing/invalid
 * - Never returns 403 (role checking is not this middleware's job)
 * 
 * Use cases:
 * - POST /auth/ensure-user (creates user doc, so can't require doc to exist first)
 * - Any endpoint that needs uid/email but not role verification
 */

const { verifyRequestAuth } = require('../services/requestAuth.service');
const { createLogger } = require('../utils/logger');

const logger = createLogger('verifyIdTokenOnly');

function send(res, status, error, message) {
    return res.status(status).json({ error, message });
}

async function verifyIdTokenOnly(req, res, next) {
    let verified;
    try {
        verified = await verifyRequestAuth(req, {
            allowSessionCookie: false,
            checkRevoked: true,
        });
    } catch (err) {
        const code = err && err.code ? err.code : 'unknown';
        logger.warn('Token verification failed:', code);
        return send(res, 401, 'invalid_token', 'Token inválido o expirado.');
    }

    if (!verified) {
        logger.warn('Missing Authorization header');
        return send(res, 401, 'unauthorized', 'Authorization token is required.');
    }

    const decoded = verified.decoded;
    const uid = decoded && decoded.uid;
    if (!uid) {
        logger.warn('Token valid but no uid found');
        return send(res, 401, 'invalid_token', 'Token inválido o expirado.');
    }

    // Set req.user with decoded token data (NO role check, NO Firestore lookup)
    req.user = {
        uid,
        email: decoded.email || null,
        emailVerified: decoded.email_verified || false,
        displayName: decoded.name || null,
        // Include any custom claims that exist (may include role if already set)
        ...decoded,
    };

    req.authTokenSource = verified.source;
    req.authTokenRaw = verified.rawToken;
    logger.debug('Token verified for uid:', uid);
    return next();
}

module.exports = verifyIdTokenOnly;
