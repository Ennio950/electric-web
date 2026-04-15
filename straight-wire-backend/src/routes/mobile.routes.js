'use strict';

const express = require('express');

const {
  getBootstrap,
  getHome,
  createPushToken,
  deletePushToken,
} = require('../controllers/mobile.controller');

const router = express.Router();

router.get('/bootstrap', getBootstrap);
router.get('/home', getHome);
router.post('/push-tokens', createPushToken);
router.delete('/push-tokens/:token', deletePushToken);

module.exports = router;
