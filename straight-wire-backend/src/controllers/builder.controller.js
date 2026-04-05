'use strict';

const { db } = require('../firebase');
const marketplaceService = require('../services/marketplace.service');
const estimatePdfService = require('../services/estimatePdf.service');
const { createLogger } = require('../utils/logger');

const logger = createLogger('builder.controller');

const ESTIMATES_COLLECTION = 'builder_estimates';

function sendError(res, status, error, message) {
    return res.status(status).json({ error, message });
}

/**
 * Converts a CalculationResult (from @electric/estimator-core) to the flat
 * items[] format expected by estimatePdf.service.renderEstimatePdf.
 */
function resultToItems(result) {
    const materialItems = Array.isArray(result.materials)
        ? result.materials.map((line) => ({
            desc: String(line.materialName || ''),
            type: 'Material',
            qty: Number(line.qty) || 0,
            price: Number(line.unitPrice) || 0,
            amount: Number(line.subtotal) || 0
        }))
        : [];

    const laborItems = Array.isArray(result.componentBreakdown)
        ? result.componentBreakdown
            .filter((comp) => Number(comp.laborSubtotal) > 0)
            .map((comp) => ({
                desc: `Labor: ${comp.name}`,
                type: 'Service',
                qty: 1,
                price: Number(comp.laborSubtotal) || 0,
                amount: Number(comp.laborSubtotal) || 0
            }))
        : [];

    if (Number(result.totals?.fixedCost) > 0) {
        laborItems.push({
            desc: 'Costo fijo',
            type: 'Service',
            qty: 1,
            price: Number(result.totals.fixedCost),
            amount: Number(result.totals.fixedCost)
        });
    }

    return [...materialItems, ...laborItems];
}

/**
 * POST /api/builder/estimates
 * Saves a mobile builder estimate snapshot to the database and allocates
 * a quote number.
 *
 * Body: { jobSnapshot, materials, recipes, result, requestId?, description? }
 * Returns: { ok, data: { estimateId, quoteNumber } }
 */
async function createEstimate(req, res) {
    try {
        const { jobSnapshot, materials, recipes, result, requestId, description } = req.body || {};

        if (!jobSnapshot || typeof jobSnapshot !== 'object') {
            return sendError(res, 400, 'invalid_input', 'jobSnapshot es requerido.');
        }
        if (!result || typeof result !== 'object') {
            return sendError(res, 400, 'invalid_input', 'result es requerido.');
        }

        const quoteNumber = await marketplaceService.allocateNextQuoteNumber();

        const estimateDoc = {
            createdByUid: req.user.uid,
            createdByEmail: req.user.email || null,
            createdByRole: req.user.role,
            quoteNumber,
            jobSnapshot,
            materials: Array.isArray(materials) ? materials : [],
            recipes: Array.isArray(recipes) ? recipes : [],
            result,
            requestId: typeof requestId === 'string' && requestId.trim() ? requestId.trim() : null,
            description: typeof description === 'string' && description.trim() ? description.trim() : null,
            createdAt: new Date().toISOString()
        };

        const docRef = await db.collection(ESTIMATES_COLLECTION).add(estimateDoc);

        logger.info('Builder estimate created:', { estimateId: docRef.id, quoteNumber, uid: req.user.uid });

        return res.status(201).json({
            ok: true,
            data: { estimateId: docRef.id, quoteNumber }
        });
    } catch (err) {
        logger.error('createEstimate error:', err);
        return res.status(500).json({
            ok: false,
            error: 'internal_error',
            message: err.message || 'Error al crear la estimacion.'
        });
    }
}

/**
 * GET /api/builder/estimates/:estimateId/pdf
 * Renders a PDF for a stored estimate and returns it as binary.
 * Supports FileSystem.downloadAsync from mobile (GET with Authorization header).
 */
async function getEstimatePdf(req, res) {
    try {
        const { estimateId } = req.params;

        const snap = await db.collection(ESTIMATES_COLLECTION).doc(estimateId).get();
        if (!snap.exists) {
            return sendError(res, 404, 'not_found', 'Estimacion no encontrada.');
        }

        const estimate = snap.data();

        if (estimate.createdByUid !== req.user.uid && req.user.role !== 'boss') {
            return sendError(res, 403, 'forbidden', 'Sin acceso a esta estimacion.');
        }

        const items = resultToItems(estimate.result);
        const totals = estimate.result.totals || {};

        const payload = {
            items,
            quoteNumber: estimate.quoteNumber,
            createdBy: {
                uid: estimate.createdByUid,
                email: estimate.createdByEmail,
                name: req.user.name || req.user.displayName || null,
                employeeCode: null
            },
            breakdown: {
                subtotal: (Number(totals.materialsSubtotal) || 0)
                    + (Number(totals.laborSubtotal) || 0)
                    + (Number(totals.fixedCost) || 0),
                taxRate: Number(totals.taxPct) || 0,
                taxAmount: Number(totals.taxAmount) || 0,
                total: Number(totals.grandTotal) || 0,
                serviceTotal: Number(totals.laborSubtotal) || 0,
                materialTotal: Number(totals.materialsSubtotal) || 0
            }
        };

        const pdfBuffer = await estimatePdfService.renderEstimatePdf(payload);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="estimate_${estimate.quoteNumber}.pdf"`);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        return res.status(200).send(pdfBuffer);
    } catch (err) {
        logger.error('getEstimatePdf error:', err);
        return res.status(500).json({
            ok: false,
            error: 'pdf_render_failed',
            message: err.message || 'Error al generar el PDF.'
        });
    }
}

/**
 * POST /api/builder/estimates/:estimateId/link-request
 * Links a saved builder estimate to a marketplace request.
 *
 * Body: { requestId }
 * Returns: { ok, data: { estimateId, requestId } }
 */
async function linkEstimateToRequest(req, res) {
    try {
        const { estimateId } = req.params;
        const { requestId } = req.body || {};

        if (typeof requestId !== 'string' || !requestId.trim()) {
            return sendError(res, 400, 'invalid_input', 'requestId es requerido.');
        }

        const snap = await db.collection(ESTIMATES_COLLECTION).doc(estimateId).get();
        if (!snap.exists) {
            return sendError(res, 404, 'not_found', 'Estimacion no encontrada.');
        }

        const estimate = snap.data();
        if (estimate.createdByUid !== req.user.uid && req.user.role !== 'boss') {
            return sendError(res, 403, 'forbidden', 'Sin acceso a esta estimacion.');
        }

        await db.collection(ESTIMATES_COLLECTION).doc(estimateId).update({
            requestId: requestId.trim(),
            linkedAt: new Date().toISOString()
        });

        return res.status(200).json({
            ok: true,
            data: { estimateId, requestId: requestId.trim() }
        });
    } catch (err) {
        logger.error('linkEstimateToRequest error:', err);
        return res.status(500).json({
            ok: false,
            error: 'internal_error',
            message: err.message || 'Error al vincular la estimacion.'
        });
    }
}

module.exports = { createEstimate, getEstimatePdf, linkEstimateToRequest };
