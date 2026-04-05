'use strict';

const recipesService = require('../services/recipes.service');
const { createLogger } = require('../utils/logger');

const logger = createLogger('recipes.controller');

function handleError(res, err) {
    const status = typeof err.status === 'number' ? err.status : 500;
    const error = typeof err.code === 'string' ? err.code : 'internal_error';
    const message = status >= 500 ? 'Internal Server Error' : (err.message || 'Request failed.');
    return res.status(status).json({ ok: false, error, message });
}

/**
 * GET /api/builder/recipes
 * List all catalog recipes.
 */
async function listRecipes(req, res) {
    try {
        const recipes = await recipesService.listRecipes();
        return res.status(200).json({ ok: true, data: recipes });
    } catch (err) {
        logger.error('listRecipes error:', err);
        return handleError(res, err);
    }
}

/**
 * PUT /api/builder/recipes/:id
 * Create or update a single recipe.
 */
async function upsertRecipe(req, res) {
    try {
        const recipe = await recipesService.upsertRecipe(
            { ...req.body, id: req.params.id },
            req.user.uid,
        );
        return res.status(200).json({ ok: true, data: recipe });
    } catch (err) {
        logger.error('upsertRecipe error:', err);
        return handleError(res, err);
    }
}

/**
 * DELETE /api/builder/recipes/:id
 * Delete a recipe by id.
 */
async function deleteRecipe(req, res) {
    try {
        const result = await recipesService.deleteRecipe(req.params.id, req.user.uid);
        return res.status(200).json({ ok: true, data: result });
    } catch (err) {
        logger.error('deleteRecipe error:', err);
        return handleError(res, err);
    }
}

/**
 * POST /api/builder/recipes/batch
 * Upsert many recipes at once (up to 200).
 * Used to push the local catalog to the server on first sync.
 */
async function batchReplaceRecipes(req, res) {
    try {
        const recipes = await recipesService.batchReplaceRecipes(
            req.body?.recipes,
            req.user.uid,
        );
        return res.status(200).json({ ok: true, data: recipes });
    } catch (err) {
        logger.error('batchReplaceRecipes error:', err);
        return handleError(res, err);
    }
}

module.exports = { listRecipes, upsertRecipe, deleteRecipe, batchReplaceRecipes };
