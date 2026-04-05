'use strict';

const { db } = require('../firebase');
const { createLogger } = require('../utils/logger');

const logger = createLogger('materials.service');
const COLLECTION = 'catalog_materials';

function cleanString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function validateMaterial(data) {
    const id = cleanString(data.id);
    const name = cleanString(data.name);
    const category = cleanString(data.category);
    const baseUnit = cleanString(data.baseUnit);
    const currency = cleanString(data.currency);
    const unitPrice = Number(data.unitPrice);

    if (id.length < 2) throw { status: 400, code: 'invalid_input', message: 'id debe tener al menos 2 caracteres.' };
    if (name.length < 2) throw { status: 400, code: 'invalid_input', message: 'name debe tener al menos 2 caracteres.' };
    if (category.length < 2) throw { status: 400, code: 'invalid_input', message: 'category debe tener al menos 2 caracteres.' };
    if (!baseUnit) throw { status: 400, code: 'invalid_input', message: 'baseUnit es requerido.' };
    if (!currency) throw { status: 400, code: 'invalid_input', message: 'currency es requerido.' };
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw { status: 400, code: 'invalid_input', message: 'unitPrice debe ser un numero no negativo.' };

    const conversions = Array.isArray(data.conversions) ? data.conversions : [];
    const densityKgPerM3 = Number(data.densityKgPerM3);

    return {
        id,
        name,
        category,
        baseUnit,
        currency,
        unitPrice,
        conversions,
        ...(Number.isFinite(densityKgPerM3) && densityKgPerM3 > 0 ? { densityKgPerM3 } : {}),
        ...(cleanString(data.notes) ? { notes: cleanString(data.notes) } : {}),
    };
}

async function listMaterials() {
    const snap = await db.collection(COLLECTION).orderBy('name').get();
    return snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function upsertMaterial(materialData, uid) {
    const material = validateMaterial(materialData);
    const docRef = db.collection(COLLECTION).doc(material.id);
    const snap = await docRef.get();
    const now = new Date().toISOString();

    if (snap.exists) {
        await docRef.update({ ...material, updatedAt: now, updatedByUid: uid });
        logger.info('Material updated:', material.id);
    } else {
        await docRef.set({ ...material, createdAt: now, updatedAt: now, createdByUid: uid });
        logger.info('Material created:', material.id);
    }

    const updated = await docRef.get();
    return { ...updated.data(), id: updated.id };
}

async function deleteMaterial(materialId, uid) {
    const docRef = db.collection(COLLECTION).doc(materialId);
    const snap = await docRef.get();
    if (!snap.exists) {
        throw { status: 404, code: 'not_found', message: 'Material no encontrado.' };
    }
    await docRef.delete();
    logger.info('Material deleted:', materialId, 'by', uid);
    return { ok: true, id: materialId };
}

async function batchReplaceMaterials(materials, uid) {
    if (!Array.isArray(materials) || materials.length === 0) {
        throw { status: 400, code: 'invalid_input', message: 'Se requiere un array de materiales.' };
    }
    if (materials.length > 200) {
        throw { status: 400, code: 'invalid_input', message: 'Maximo 200 materiales por batch.' };
    }

    const now = new Date().toISOString();
    const batch = db.batch();

    for (const item of materials) {
        const material = validateMaterial(item);
        const docRef = db.collection(COLLECTION).doc(material.id);
        batch.set(docRef, { ...material, updatedAt: now, createdAt: now, createdByUid: uid }, { merge: true });
    }

    await batch.commit();
    logger.info(`Batch upserted ${materials.length} materials by ${uid}`);
    return listMaterials();
}

module.exports = { listMaterials, upsertMaterial, deleteMaterial, batchReplaceMaterials };
