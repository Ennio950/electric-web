'use strict';

// Health check routes (public).

const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    service: 'Straight Wire Electric CRM Backend',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;

