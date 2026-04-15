'use strict';

const requireBoss = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'Not authenticated.' },
    });
  }

  if (req.user.role !== 'boss') {
    return res.status(403).json({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Boss role required.' },
    });
  }

  return next();
};

module.exports = { requireBoss };

