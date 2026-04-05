'use strict';

const express = require('express');
const router = express.Router();

const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const requireRole = require('../middleware/requireRole');
const controller = require('../controllers/recipes.controller');

router.use(verifyFirebaseToken);
router.use(requireRole(['employee', 'boss']));

router.get('/', controller.listRecipes);
router.put('/:id', controller.upsertRecipe);
router.delete('/:id', controller.deleteRecipe);
router.post('/batch', controller.batchReplaceRecipes);

module.exports = router;
