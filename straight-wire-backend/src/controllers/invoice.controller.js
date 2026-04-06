'use strict';

const { db } = require('../firebase');
const estimatePdfService = require('../services/estimatePdf.service');
const { createLogger } = require('../utils/logger');

const logger = createLogger('invoice.controller');
const COLLECTION = 'builder_invoices';

function sendError(res, status, error, message) {
    return res.status(status).json({ ok: false, error, message });
}

async function allocateNextInvoiceNumber() {
    const counterRef = db.collection('system').doc('invoiceCounter');
    const nextValue = await db.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef);
        const current = snap.exists ? Number(snap.data()?.lastValue || 0) : 0;
        const safe = Number.isFinite(current) && current >= 0 ? current : 0;
        const next = safe + 1;
        tx.set(counterRef, { lastValue: next, updatedAt: new Date().toISOString() }, { merge: true });
        return next;
    });
    return `IN${String(nextValue).padStart(6, '0')}`;
}

/**
 * GET /api/builder/invoices
 * List saved invoices. Employees see their own; boss sees all.
 */
async function listInvoices(req, res) {
    try {
        let query;
        if (req.user.role === 'boss') {
            query = db.collection(COLLECTION).orderBy('createdAt', 'desc').limit(100);
        } else {
            query = db.collection(COLLECTION)
                .where('createdByUid', '==', req.user.uid)
                .orderBy('createdAt', 'desc')
                .limit(50);
        }
        const snap = await query.get();
        const invoices = snap.docs.map((doc) => {
            const d = doc.data();
            return {
                id: doc.id,
                invoiceNumber: d.invoiceNumber,
                clientName: d.clientName || null,
                clientAddress: d.clientAddress || null,
                dueDate: d.dueDate || null,
                notes: d.notes || null,
                total: d.total ?? 0,
                currency: d.currency || 'GTQ',
                createdAt: d.createdAt,
                createdByEmail: d.createdByEmail || null,
            };
        });
        return res.status(200).json({ ok: true, data: invoices });
    } catch (err) {
        logger.error('listInvoices error:', err);
        return sendError(res, 500, 'internal_error', err.message);
    }
}

/**
 * POST /api/builder/invoices
 * Creates an invoice and stores it in Firestore.
 * Body: { clientName, clientAddress, items[], taxPct, currency, dueDate, notes }
 * Returns: { invoiceId, invoiceNumber }
 */
async function createInvoice(req, res) {
    try {
        const { clientName, clientAddress, items, taxPct, currency, dueDate, notes } = req.body || {};

        if (!clientName || typeof clientName !== 'string') {
            return sendError(res, 400, 'invalid_input', 'clientName es requerido.');
        }
        if (!Array.isArray(items) || items.length === 0) {
            return sendError(res, 400, 'invalid_input', 'items es requerido y debe tener al menos un elemento.');
        }

        const cleanedItems = items.map((item) => ({
            desc: String(item.desc || ''),
            type: String(item.type || 'Service'),
            qty: Number(item.qty) || 1,
            price: Number(item.price) || 0,
            amount: Number(item.amount) || (Number(item.qty) * Number(item.price)),
        }));

        const subtotal = cleanedItems.reduce((sum, item) => sum + item.amount, 0);
        const safeTaxPct = Math.max(0, Math.min(100, Number(taxPct) || 0));
        const taxAmount = subtotal * (safeTaxPct / 100);
        const total = subtotal + taxAmount;

        const invoiceNumber = await allocateNextInvoiceNumber();

        const doc = {
            invoiceNumber,
            createdByUid: req.user.uid,
            createdByEmail: req.user.email || null,
            clientName: String(clientName).trim(),
            clientAddress: typeof clientAddress === 'string' ? clientAddress.trim() : '',
            items: cleanedItems,
            subtotal,
            taxPct: safeTaxPct,
            taxAmount,
            total,
            currency: typeof currency === 'string' ? currency.trim() : 'GTQ',
            dueDate: typeof dueDate === 'string' ? dueDate.trim() : null,
            notes: typeof notes === 'string' ? notes.trim() : null,
            createdAt: new Date().toISOString(),
        };

        const docRef = await db.collection(COLLECTION).add(doc);
        logger.info('Invoice created:', { invoiceId: docRef.id, invoiceNumber, uid: req.user.uid });

        return res.status(201).json({ ok: true, data: { invoiceId: docRef.id, invoiceNumber } });
    } catch (err) {
        logger.error('createInvoice error:', err);
        return sendError(res, 500, 'internal_error', err.message);
    }
}

/**
 * GET /api/builder/invoices/:invoiceId/pdf
 * Renders and returns the invoice as a PDF binary.
 */
async function getInvoicePdf(req, res) {
    try {
        const snap = await db.collection(COLLECTION).doc(req.params.invoiceId).get();
        if (!snap.exists) {
            return sendError(res, 404, 'not_found', 'Factura no encontrada.');
        }

        const inv = snap.data();
        if (inv.createdByUid !== req.user.uid && req.user.role !== 'boss') {
            return sendError(res, 403, 'forbidden', 'Sin acceso a esta factura.');
        }

        const pdfBuffer = await estimatePdfService.renderEstimatePdf({
            items: inv.items,
            quoteNumber: inv.invoiceNumber,
            createdBy: {
                uid: inv.createdByUid,
                email: inv.createdByEmail,
                name: req.user.name || req.user.displayName || null,
            },
            breakdown: {
                subtotal: inv.subtotal,
                taxRate: inv.taxPct,
                taxAmount: inv.taxAmount,
                total: inv.total,
                serviceTotal: inv.items.filter(i => i.type !== 'Material').reduce((s, i) => s + i.amount, 0),
                materialTotal: inv.items.filter(i => i.type === 'Material').reduce((s, i) => s + i.amount, 0),
            },
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="invoice_${inv.invoiceNumber}.pdf"`);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).send(pdfBuffer);
    } catch (err) {
        logger.error('getInvoicePdf error:', err);
        return sendError(res, 500, 'pdf_render_failed', err.message);
    }
}

module.exports = { listInvoices, createInvoice, getInvoicePdf };
