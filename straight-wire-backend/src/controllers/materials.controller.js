'use strict';

const materialsService = require('../services/materials.service');
const { createLogger } = require('../utils/logger');

const logger = createLogger('materials.controller');

function handleError(res, err) {
    const status = typeof err.status === 'number' ? err.status : 500;
    const error = typeof err.code === 'string' ? err.code : 'internal_error';
    const message = status >= 500 ? 'Internal Server Error' : (err.message || 'Request failed.');
    return res.status(status).json({ ok: false, error, message });
}

/**
 * GET /api/builder/materials
 * List all catalog materials.
 */
async function listMaterials(req, res) {
    try {
        const materials = await materialsService.listMaterials();
        return res.status(200).json({ ok: true, data: materials });
    } catch (err) {
        logger.error('listMaterials error:', err);
        return handleError(res, err);
    }
}

/**
 * PUT /api/builder/materials/:id
 * Create or update a single material.
 */
async function upsertMaterial(req, res) {
    try {
        const material = await materialsService.upsertMaterial(
            { ...req.body, id: req.params.id },
            req.user.uid,
        );
        return res.status(200).json({ ok: true, data: material });
    } catch (err) {
        logger.error('upsertMaterial error:', err);
        return handleError(res, err);
    }
}

/**
 * DELETE /api/builder/materials/:id
 * Delete a material by id.
 */
async function deleteMaterial(req, res) {
    try {
        const result = await materialsService.deleteMaterial(req.params.id, req.user.uid);
        return res.status(200).json({ ok: true, data: result });
    } catch (err) {
        logger.error('deleteMaterial error:', err);
        return handleError(res, err);
    }
}

/**
 * POST /api/builder/materials/batch
 * Upsert many materials at once (up to 200).
 * Used to push the local catalog to the server on first sync.
 */
async function batchReplaceMaterials(req, res) {
    try {
        const materials = await materialsService.batchReplaceMaterials(
            req.body?.materials,
            req.user.uid,
        );
        return res.status(200).json({ ok: true, data: materials });
    } catch (err) {
        logger.error('batchReplaceMaterials error:', err);
        return handleError(res, err);
    }
}

module.exports = { listMaterials, upsertMaterial, deleteMaterial, batchReplaceMaterials };
