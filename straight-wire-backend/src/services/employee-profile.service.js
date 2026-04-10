'use strict';

/**
 * Employee Profile Service
 * 
 * Manages employee portfolio photos and ratings.
 * - Portfolio: Max 10 photos, oldest deleted when adding new
 * - Rating: Running average from all client reviews
 */

const { admin, auth, db } = require('../firebase');
const { createLogger } = require('../utils/logger');

const USERS_COLLECTION = 'users';
const MAX_PORTFOLIO_PHOTOS = 10;
const logger = createLogger('employee-profile');

function cleanString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function pickBestName(...values) {
    let emailFallback = '';
    for (const value of values) {
        const candidate = cleanString(value);
        if (!candidate) continue;
        if (candidate.includes('@')) {
            if (!emailFallback) emailFallback = candidate;
            continue;
        }
        return candidate;
    }
    return emailFallback;
}

async function resolveIdentity(employeeId, data = {}) {
    const profileName = pickBestName(data.name, data.displayName, data.nombre, data.fullName);
    const profileEmail = cleanString(data.email || data.correo);
    const profilePhoto = cleanString(data.profilePhoto || data.photoUrl || data.photoURL);

    if (profileName && profileEmail && profilePhoto) {
        return {
            name: profileName,
            email: profileEmail,
            photoUrl: profilePhoto,
        };
    }

    try {
        const user = await auth.getUser(employeeId);
        return {
            name: pickBestName(profileName, user.displayName, user.email),
            email: cleanString(profileEmail || user.email),
            photoUrl: cleanString(profilePhoto || user.photoURL),
        };
    } catch (_) {
        return {
            name: profileName,
            email: profileEmail,
            photoUrl: profilePhoto,
        };
    }
}

/**
 * Add a photo to employee's portfolio.
 * Keeps only the last MAX_PORTFOLIO_PHOTOS photos.
 */
async function addPortfolioPhoto(employeeId, photoUrl) {
    if (!employeeId || !photoUrl) return;

    const userRef = db.collection(USERS_COLLECTION).doc(employeeId);
    const snap = await userRef.get();

    if (!snap.exists) {
        logger.warn('User not found:', employeeId);
        return;
    }

    const data = snap.data();
    let portfolio = data.portfolio || [];

    // Add new photo
    portfolio.push({
        url: photoUrl,
        addedAt: new Date().toISOString()
    });

    // Keep only last MAX_PORTFOLIO_PHOTOS
    if (portfolio.length > MAX_PORTFOLIO_PHOTOS) {
        // Remove oldest photos
        const toRemove = portfolio.length - MAX_PORTFOLIO_PHOTOS;
        const removedPhotos = portfolio.splice(0, toRemove);
        logger.info('Pruned', toRemove, 'old photos from portfolio');

        // Optionally delete from Cloudinary here in the future
    }

    await userRef.update({
        portfolio,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info('Added photo to portfolio:', employeeId, 'total:', portfolio.length);
    return portfolio;
}

/**
 * Update employee's average rating.
 * Uses running average calculation.
 */
async function updateRating(employeeId, newRating) {
    if (!employeeId || !Number.isFinite(newRating)) return;

    // Clamp rating to 1-5
    const rating = Math.max(1, Math.min(5, newRating));

    const userRef = db.collection(USERS_COLLECTION).doc(employeeId);
    const snap = await userRef.get();

    if (!snap.exists) {
        logger.warn('User not found:', employeeId);
        return;
    }

    const data = snap.data();
    const currentRating = data.rating || { average: 0, totalRatings: 0, totalSum: 0 };

    // Calculate new average
    const newTotalSum = currentRating.totalSum + rating;
    const newTotalRatings = currentRating.totalRatings + 1;
    const newAverage = Math.round((newTotalSum / newTotalRatings) * 10) / 10; // 1 decimal

    const updatedRating = {
        average: newAverage,
        totalRatings: newTotalRatings,
        totalSum: newTotalSum
    };

    await userRef.update({
        rating: updatedRating,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info('Updated rating:', employeeId,
        'new:', rating, 'average:', newAverage, 'total:', newTotalRatings);

    return updatedRating;
}

/**
 * Get employee public profile (portfolio + rating).
 */
async function getEmployeeProfile(employeeId) {
    if (!employeeId) return null;

    const userRef = db.collection(USERS_COLLECTION).doc(employeeId);
    const snap = await userRef.get();

    if (!snap.exists) {
        return null;
    }

    const data = snap.data() || {};
    const identity = await resolveIdentity(employeeId, data);
    const resolvedName = pickBestName(identity.name, data.name, data.displayName, data.email);
    const resolvedEmail = cleanString(identity.email || data.email);
    const resolvedPhoto = cleanString(identity.photoUrl || data.photoUrl || data.profilePhoto);

    return {
        id: employeeId,
        name: resolvedName || 'Técnico',
        displayName: resolvedName || null,
        email: resolvedEmail || null,
        portfolio: data.portfolio || [],
        rating: data.rating || { average: 0, totalRatings: 0 },
        createdAt: data.createdAt?.toDate?.() || null,
        age: data.age ?? null,
        photoUrl: resolvedPhoto || null,
        profilePhoto: resolvedPhoto || null,
        address: data.address || null
    };
}

/**
 * Update employee's own profile.
 */
async function updateProfile(employeeId, updates = {}) {
    if (!employeeId) return null;

    const userRef = db.collection(USERS_COLLECTION).doc(employeeId);

    // Only allow specific fields
    const allowedFields = ['name', 'age', 'address', 'profilePhoto', 'displayName'];
    const dataToUpdate = {};

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            dataToUpdate[field] = updates[field];
        }
    }

    const normalizedName = cleanString(dataToUpdate.name);
    const normalizedDisplayName = cleanString(dataToUpdate.displayName);
    if (normalizedName && !normalizedDisplayName) {
        dataToUpdate.displayName = normalizedName;
    } else if (!normalizedName && normalizedDisplayName) {
        dataToUpdate.name = normalizedDisplayName;
    }
    if (Object.keys(dataToUpdate).length === 0) {
        return null;
    }

    dataToUpdate.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await userRef.update(dataToUpdate);
    logger.info('Updated profile for:', employeeId, Object.keys(dataToUpdate));

    const fresh = await userRef.get();
    return fresh.data();
}

module.exports = {
    addPortfolioPhoto,
    updateRating,
    getEmployeeProfile,
    updateProfile,
    MAX_PORTFOLIO_PHOTOS
};


