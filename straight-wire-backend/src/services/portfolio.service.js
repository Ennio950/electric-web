'use strict';

/**
 * Portfolio Service
 * 
 * Manages employee portfolios with FIFO max 10 photos.
 * Collection: employees/{uid}/portfolio/{photoId}
 */

const { admin, db } = require('../firebase');
const { appError } = require('../utils/errors');

const EMPLOYEES_COLLECTION = 'employees';
const PORTFOLIO_SUBCOLLECTION = 'portfolio';
const MAX_PORTFOLIO_SIZE = 10;

// ============================================================
// Helpers
// ============================================================

function serverTimestamp() {
    return admin.firestore.FieldValue.serverTimestamp();
}

function requireNonEmptyString(value, label) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw appError(400, 'invalid_input', `${label} is required.`);
    }
    return value.trim();
}

function mapDoc(doc) {
    if (!doc.exists) return null;
    const data = doc.data() || {};
    const result = { id: doc.id };
    for (const [key, value] of Object.entries(data)) {
        if (value && typeof value.toDate === 'function') {
            result[key] = value.toDate().toISOString();
        } else {
            result[key] = value;
        }
    }
    return result;
}

// ============================================================
// Add to Portfolio (with FIFO cleanup)
// ============================================================

/**
 * Adds a photo to an employee's portfolio.
 * If portfolio exceeds MAX_PORTFOLIO_SIZE, removes oldest photos.
 * 
 * @param {string} employeeUid 
 * @param {string} photoUrl 
 * @param {string} requestId - The request this photo came from
 */
async function addToPortfolio(employeeUid, photoUrl, requestId) {
    requireNonEmptyString(employeeUid, 'employeeUid');
    requireNonEmptyString(photoUrl, 'photoUrl');
    requireNonEmptyString(requestId, 'requestId');

    const portfolioRef = db.collection(EMPLOYEES_COLLECTION)
        .doc(employeeUid)
        .collection(PORTFOLIO_SUBCOLLECTION);

    // 1. Add new photo
    const newPhotoRef = portfolioRef.doc();
    await newPhotoRef.set({
        url: photoUrl.trim(),
        requestId: requestId,
        createdAt: serverTimestamp(),
    });

    // 2. Check total count and delete oldest if > MAX
    const allPhotos = await portfolioRef
        .orderBy('createdAt', 'asc')
        .get();

    const totalCount = allPhotos.size;

    if (totalCount > MAX_PORTFOLIO_SIZE) {
        const excess = totalCount - MAX_PORTFOLIO_SIZE;
        const toDelete = allPhotos.docs.slice(0, excess);

        const batch = db.batch();
        for (const doc of toDelete) {
            batch.delete(doc.ref);
        }
        await batch.commit();
    }

    return { id: newPhotoRef.id, url: photoUrl.trim(), requestId };
}

// ============================================================
// List Portfolio
// ============================================================

/**
 * Lists all photos in an employee's portfolio.
 * 
 * @param {string} employeeUid 
 */
async function listPortfolio(employeeUid) {
    requireNonEmptyString(employeeUid, 'employeeUid');

    const snap = await db.collection(EMPLOYEES_COLLECTION)
        .doc(employeeUid)
        .collection(PORTFOLIO_SUBCOLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(MAX_PORTFOLIO_SIZE)
        .get();

    return snap.docs.map(mapDoc);
}

// ============================================================
// Get Portfolio Count
// ============================================================

/**
 * Gets the current portfolio count for an employee.
 */
async function getPortfolioCount(employeeUid) {
    requireNonEmptyString(employeeUid, 'employeeUid');

    const snap = await db.collection(EMPLOYEES_COLLECTION)
        .doc(employeeUid)
        .collection(PORTFOLIO_SUBCOLLECTION)
        .count()
        .get();

    return snap.data().count;
}

module.exports = {
    addToPortfolio,
    listPortfolio,
    getPortfolioCount,
    MAX_PORTFOLIO_SIZE,
};
