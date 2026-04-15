'use strict';

/**
 * Cloudinary Configuration
 * 
 * Reads credentials from environment variables.
 * Supports two options:
 * - Option 1: CLOUDINARY_URL (contains all info)
 * - Option 2: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */

const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
// If CLOUDINARY_URL is set, cloudinary auto-configures from it
// Otherwise, use individual env vars
if (!process.env.CLOUDINARY_URL) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (cloudName && apiKey && apiSecret) {
        cloudinary.config({
            cloud_name: cloudName,
            api_key: apiKey,
            api_secret: apiSecret,
            secure: true,
        });
        console.log('[cloudinary] Configured via individual env vars');
    } else {
        console.warn('[cloudinary] WARNING: No Cloudinary credentials found in env vars');
        console.warn('[cloudinary] Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET');
    }
} else {
    // CLOUDINARY_URL is automatically used by cloudinary SDK
    console.log('[cloudinary] Configured via CLOUDINARY_URL');
}

/**
 * Upload a buffer to Cloudinary using upload_stream
 * @param {Buffer} buffer - File buffer
 * @param {object} options - { folder, resource_type, transformation, etc }
 * @returns {Promise<object>} - Cloudinary upload result
 */
function uploadBuffer(buffer, options = {}) {
    return new Promise((resolve, reject) => {
        const uploadOptions = {
            folder: options.folder || 'straightwire/uploads',
            resource_type: options.resource_type || 'image',
            ...options,
        };

        const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
                if (error) {
                    console.error('[cloudinary] Upload error:', error);
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );

        uploadStream.end(buffer);
    });
}

module.exports = {
    cloudinary,
    uploadBuffer,
};
