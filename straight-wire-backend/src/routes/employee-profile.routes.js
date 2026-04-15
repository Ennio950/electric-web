'use strict';

/**
 * Employee Profile Routes
 * 
 * Public endpoint for clients to view employee portfolios and ratings.
 * 
 * GET /api/employees/:id/profile - Get employee public profile
 */

const express = require('express');
const router = express.Router();

const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const requireRole = require('../middleware/requireRole');
const employeeProfileService = require('../services/employee-profile.service');
const photoChangeService = require('../services/employeePhotoChange.service');

/**
 * GET /api/employees/:id/profile
 * 
 * Get employee public profile (portfolio + rating).
 * Requires authentication and a valid app role.
 */
router.get(
    '/:id/profile',
    verifyFirebaseToken,
    requireRole.requireMobileUser,
    async (req, res) => {
        try {
            const employeeId = req.params.id;

            if (!employeeId) {
                return res.status(400).json({
                    success: false,
                    error: 'invalid_input',
                    message: 'Employee ID requerido',
                });
            }

            const profile = await employeeProfileService.getEmployeeProfile(employeeId);

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    error: 'not_found',
                    message: 'Empleado no encontrado',
                });
            }

            res.json({
                success: true,
                data: profile
            });
        } catch (err) {
            console.error('[employee-profile] Get profile error:', err);
            res.status(500).json({
                success: false,
                error: 'server_error',
                message: err.message || 'Error obteniendo perfil',
            });
        }
    }
);

/**
 * PATCH /api/employees/me
 * 
 * Update authenticated employee's profile.
 * Requires authentication and employee role.
 */
router.patch(
    '/me',
    verifyFirebaseToken,
    requireRole.requireEmployee,
    async (req, res) => {
        try {
            const employeeId = req.user.uid;
            const updates = req.body;

            if (!updates || typeof updates !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'invalid_input',
                    message: 'Payload de actualización requerido',
                });
            }

            if ('profilePhoto' in updates) {
                return res.status(400).json({
                    success: false,
                    error: 'photo_change_required',
                    message: 'Para cambiar la foto debes solicitar aprobacion del jefe.',
                });
            }

            const updatedProfile = await employeeProfileService.updateProfile(employeeId, updates);

            if (!updatedProfile) {
                return res.status(400).json({
                    success: false,
                    error: 'no_changes',
                    message: 'No se realizaron cambios o campos inválidos',
                });
            }

            res.json({
                success: true,
                data: updatedProfile
            });
        } catch (err) {
            console.error('[employee-profile] Update profile error:', err);
            res.status(500).json({
                success: false,
                error: 'server_error',
                message: err.message || 'Error actualizando perfil',
            });
        }
    }
);

/**
 * GET /api/employees/me/photo-change
 * Returns current photo change request status.
 */
router.get(
    '/me/photo-change',
    verifyFirebaseToken,
    requireRole.requireEmployee,
    async (req, res) => {
        try {
            const employeeId = req.user.uid;
            const reqDoc = await photoChangeService.getPhotoChangeRequest(employeeId);
            if (!reqDoc) {
                return res.json({ success: true, data: { status: 'none' } });
            }
            return res.json({ success: true, data: reqDoc });
        } catch (err) {
            console.error('[employee-photo] Get status error:', err);
            return res.status(500).json({
                success: false,
                error: 'server_error',
                message: err.message || 'Error obteniendo estado',
            });
        }
    }
);

/**
 * POST /api/employees/me/photo-change/request
 * Create a new photo change request (pending).
 */
router.post(
    '/me/photo-change/request',
    verifyFirebaseToken,
    requireRole.requireEmployee,
    async (req, res) => {
        try {
            const employeeId = req.user.uid;
            const email = req.user.email || '';
            const displayName = req.user.name || req.user.displayName || '';
            const created = await photoChangeService.requestPhotoChange(employeeId, email, displayName);
            return res.json({ success: true, data: created });
        } catch (err) {
            console.error('[employee-photo] Request error:', err);
            const status = err.status || 500;
            return res.status(status).json({
                success: false,
                error: err.code || 'server_error',
                message: err.message || 'Error solicitando cambio de foto',
            });
        }
    }
);

/**
 * POST /api/employees/me/photo-change/submit
 * Submit new selfie after approval.
 */
router.post(
    '/me/photo-change/submit',
    verifyFirebaseToken,
    requireRole.requireEmployee,
    async (req, res) => {
        try {
            const employeeId = req.user.uid;
            const photoUrl = req.body && req.body.photoUrl;
            if (!photoUrl) {
                return res.status(400).json({
                    success: false,
                    error: 'invalid_input',
                    message: 'photoUrl es requerido',
                });
            }

            const updated = await photoChangeService.completePhotoChange(employeeId, photoUrl);
            return res.json({ success: true, data: updated });
        } catch (err) {
            console.error('[employee-photo] Submit error:', err);
            const status = err.status || 500;
            return res.status(status).json({
                success: false,
                error: err.code || 'server_error',
                message: err.message || 'Error actualizando foto',
            });
        }
    }
);

module.exports = router;
