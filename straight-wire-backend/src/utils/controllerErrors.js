// AutoDev managed backend controller error helpers
function sendApiError(res, status, error, message) {
  return res.status(status).json({ ok: false, error, message });
}

function handleApiError(res, err) {
  const status = err && typeof err.status === 'number' ? err.status : 500;
  const error = err && typeof err.code === 'string' ? err.code.toLowerCase() : 'internal_error';
  const message = status >= 500 ? 'Internal Server Error' : err.message || 'Request failed.';
  return sendApiError(res, status, error, message);
}

module.exports = {
  sendApiError,
  handleApiError,
};
