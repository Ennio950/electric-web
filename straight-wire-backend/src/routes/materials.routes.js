'use strict';

const express = require('express');
const router = express.Router();

const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const requireRole = require('../middleware/requireRole');
const controller = require('../controllers/materials.controller');

router.use(verifyFirebaseToken);
router.use(requireRole(['employee', 'boss']));

router.get('/', controller.listMaterials);
router.put('/:id', controller.upsertMaterial);
router.delete('/:id', controller.deleteMaterial);
router.post('/batch', controller.batchReplaceMaterials);

module.exports = router;
