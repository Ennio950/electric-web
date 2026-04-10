'use strict';

function appError(status, code, message, details) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  if (details !== undefined) err.details = details;
  return err;
}

function isFirestoreIndexRequiredError(err) {
  // Firestore typically throws:
  // - code: 9 (FAILED_PRECONDITION)
  // - message containing "requires an index"
  const message = err && typeof err.message === 'string' ? err.message : '';
  const code = err && (err.code || err.status);

  const looksLikeFailedPrecondition = code === 9 || code === 'FAILED_PRECONDITION';
  const mentionsIndex = message.toLowerCase().includes('requires an index');

  return Boolean(looksLikeFailedPrecondition && mentionsIndex);
}

module.exports = {
  appError,
  isFirestoreIndexRequiredError,
};

