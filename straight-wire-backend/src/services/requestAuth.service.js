'use strict';

const { auth } = require('../firebase');
const { extractBearerToken, extractPortalSessionCookie } = require('../utils/authTokens');

async function verifyRequestAuth(req, options = {}) {
  const allowSessionCookie = options.allowSessionCookie !== false;
  const checkRevoked = options.checkRevoked !== false;

  const idToken = extractBearerToken(req);
  if (idToken) {
    const decoded = await auth.verifyIdToken(idToken, checkRevoked);
    return {
      decoded,
      rawToken: idToken,
      source: 'id_token',
    };
  }

  if (!allowSessionCookie) {
    return null;
  }

  const sessionCookie = extractPortalSessionCookie(req);
  if (!sessionCookie) {
    return null;
  }

  const decoded = await auth.verifySessionCookie(sessionCookie, checkRevoked);
  return {
    decoded,
    rawToken: sessionCookie,
    source: 'session_cookie',
  };
}

module.exports = {
  verifyRequestAuth,
};
