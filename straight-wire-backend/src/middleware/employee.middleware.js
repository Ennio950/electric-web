'use strict';

// Employee access guard.
// - Ensures the request is authenticated (auth middleware must run before this).
// - Ensures the user has role "employee".
// - Injects req.employeeId for downstream handlers.

const auth = require('./auth');
const requireRole = require('./requireRole');

function sendError(res, status, code, message) {
  return res.status(status).json({
    ok: false,
    error: { code, message },
  });
}

function ensureEmployeeContext(req, res, next) {
  if (!req.user || !req.user.uid) {
    return sendError(res, 401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  const role = typeof req.user.role === 'string' ? req.user.role : null;
  if (role !== 'employee') {
    return sendError(res, 403, 'FORBIDDEN', 'Employee role required.');
  }

  req.employeeId = req.user.uid;
  return next();
}

// Export as an array so it can be mounted directly.
module.exports = [auth, requireRole('employee'), ensureEmployeeContext];

