'use strict';

const { db } = require('../firebase');
const { createLogger } = require('../utils/logger');

const logger = createLogger('recipes.service');
const COLLECTION = 'catalog_recipes';

function cleanString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function validateRecipe(data) {
    const id = cleanString(data.id);
    const name = cleanString(data.name);
    const type = cleanString(data.type);
    const baseUnit = cleanString(data.baseUnit);
    const description = cleanString(data.description);

    if (id.length < 2) throw { status: 400, code: 'invalid_input', message: 'id debe tener al menos 2 caracteres.' };
    if (name.length < 2) throw { status: 400, code: 'invalid_input', message: 'name debe tener al menos 2 caracteres.' };
    if (!type) throw { status: 400, code: 'invalid_input', message: 'type es requerido.' };
    if (!baseUnit) throw { status: 400, code: 'invalid_input', message: 'baseUnit es requerido.' };

    const params = Array.isArray(data.params) ? data.params : [];
    const outputs = Array.isArray(data.outputs) ? data.outputs : [];

    return {
        id,
        name,
        type,
        baseUnit,
        params,
        outputs,
        ...(description ? { description } : {}),
    };
}

async function listRecipes() {
    const snap = await db.collection(COLLECTION).orderBy('name').get();
    return snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function upsertRecipe(recipeData, uid) {
    const recipe = validateRecipe(recipeData);
    const docRef = db.collection(COLLECTION).doc(recipe.id);
    const snap = await docRef.get();
    const now = new Date().toISOString();

    if (snap.exists) {
        await docRef.update({ ...recipe, updatedAt: now, updatedByUid: uid });
        logger.info('Recipe updated:', recipe.id);
    } else {
        await docRef.set({ ...recipe, createdAt: now, updatedAt: now, createdByUid: uid });
        logger.info('Recipe created:', recipe.id);
    }

    const updated = await docRef.get();
    return { ...updated.data(), id: updated.id };
}

async function deleteRecipe(recipeId, uid) {
    const docRef = db.collection(COLLECTION).doc(recipeId);
    const snap = await docRef.get();
    if (!snap.exists) {
        throw { status: 404, code: 'not_found', message: 'Receta no encontrada.' };
    }
    await docRef.delete();
    logger.info('Recipe deleted:', recipeId, 'by', uid);
    return { ok: true, id: recipeId };
}

async function batchReplaceRecipes(recipes, uid) {
    if (!Array.isArray(recipes) || recipes.length === 0) {
        throw { status: 400, code: 'invalid_input', message: 'Se requiere un array de recetas.' };
    }
    if (recipes.length > 200) {
        throw { status: 400, code: 'invalid_input', message: 'Maximo 200 recetas por batch.' };
    }

    const now = new Date().toISOString();
    const batch = db.batch();

    for (const item of recipes) {
        const recipe = validateRecipe(item);
        const docRef = db.collection(COLLECTION).doc(recipe.id);
        batch.set(docRef, { ...recipe, updatedAt: now, createdAt: now, createdByUid: uid }, { merge: true });
    }

    await batch.commit();
    logger.info(`Batch upserted ${recipes.length} recipes by ${uid}`);
    return listRecipes();
}

module.exports = { listRecipes, upsertRecipe, deleteRecipe, batchReplaceRecipes };
