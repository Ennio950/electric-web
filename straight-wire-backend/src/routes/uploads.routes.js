'use strict';

/**
 * Uploads Routes
 *
 * POST /api/uploads/image - Upload an image to Cloudinary
 *
 * Middleware: verifyIdTokenOnly (requires valid Firebase token, no role check)
 * This allows any authenticated user to upload images.
 */

const express = require('express');
const multer = require('multer');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const verifyIdTokenOnly = require('../middleware/verifyIdTokenOnly');
const { uploadBuffer } = require('../config/cloudinary');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const logger = createLogger('uploads');

const uploadImageLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        ok: false,
        error: 'rate_limited',
        message: 'Too many upload attempts. Try again later.',
    },
    keyGenerator: (req) => {
        const uid = req.user && typeof req.user.uid === 'string' ? req.user.uid.trim() : '';
        return uid || ipKeyGenerator(req);
    },
});

// Multer config: memory storage, 15MB limit
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 15 * 1024 * 1024, // 15MB
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido. Solo: JPEG, PNG, WebP'), false);
        }
    },
});

/**
 * POST /api/uploads/image
 *
 * Upload an image file to Cloudinary.
 *
 * Request:
 *   Headers: Authorization: Bearer <Firebase ID Token>
 *   Body: multipart/form-data with field "image"
 *
 * Response:
 *   200 { ok: true, url, publicId, width, height }
 *   400 { ok: false, error, message } - validation error
 *   401 { error, message } - auth error
 *   429 { ok: false, error, message } - rate limit exceeded
 *   500 { ok: false, error, message } - upload error
 */
router.post(
    '/image',
    verifyIdTokenOnly,
    uploadImageLimiter,
    (req, res, next) => {
        // Handle multer upload with error handling
        upload.single('image')(req, res, (err) => {
            if (err) {
                if (err instanceof multer.MulterError) {
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.status(400).json({
                            ok: false,
                            error: 'file_too_large',
                            message: 'El archivo excede el límite de 15MB',
                        });
                    }
                    return res.status(400).json({
                        ok: false,
                        error: 'upload_error',
                        message: err.message,
                    });
                }
                // File filter error or other error
                return res.status(400).json({
                    ok: false,
                    error: 'invalid_file',
                    message: err.message || 'Error al procesar archivo',
                });
            }
            next();
        });
    },
    async (req, res) => {
        // Check if file was provided
        if (!req.file) {
            return res.status(400).json({
                ok: false,
                error: 'no_file',
                message: 'No se proporcionó ningún archivo. Use field name: image',
            });
        }

        // Check Cloudinary credentials
        const cloudConfig = require('cloudinary').v2.config();
        if (!cloudConfig.cloud_name || !cloudConfig.api_key || !cloudConfig.api_secret) {
            logger.error('Cloudinary not configured - missing credentials');
            return res.status(500).json({
                ok: false,
                error: 'cloudinary_not_configured',
                message: 'Cloudinary no está configurado. Contacte al administrador.',
            });
        }

        const uid = req.user?.uid || 'unknown';
        logger.debug('Image upload started by uid:', uid, 'size:', req.file.size);

        try {
            const result = await uploadBuffer(req.file.buffer, {
                folder: 'straightwire/client-requests',
                resource_type: 'image',
                // Add timestamp and uid to make public_id unique
                public_id: `${Date.now()}_${uid.slice(0, 8)}`,
            });

            logger.info('Image uploaded successfully:', result.public_id);

            return res.status(200).json({
                ok: true,
                url: result.secure_url,
                publicId: result.public_id,
                width: result.width,
                height: result.height,
            });
        } catch (err) {
            logger.error('Cloudinary upload failed:', err);
            return res.status(500).json({
                ok: false,
                error: 'upload_failed',
                message: 'Error al subir imagen. Intenta de nuevo.',
            });
        }
    }
);

module.exports = router;
