'use strict';

// Public routes (no auth).

const express = require('express');
const { rateLimit } = require('express-rate-limit');

const { postPublicRequest, getPublicCompanyConfig } = require('../controllers/public.controller');

const router = express.Router();

// Extra rate-limit for public endpoints (global rate-limit also applies).
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Too many requests. Try again later.' },
});

router.get('/company-config', getPublicCompanyConfig);
router.post('/requests', publicLimiter, postPublicRequest);

module.exports = router;
