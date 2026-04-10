/**
 * Earnings Controller
 * Handles boss earnings endpoints.
 */
const earningsService = require('../services/earnings.service');

/**
 * GET /api/marketplace/boss/earnings
 * Returns earnings summary and optional history.
 */
async function getEarnings(req, res) {
    try {
        const includeHistory = req.query.history === 'true';
        const historyLimit = Math.min(parseInt(req.query.limit) || 50, 200);

        const summary = await earningsService.getEarningsSummary();

        const response = {
            success: true,
            data: {
                summary,
                commissionRate: earningsService.COMMISSION_RATE
            }
        };

        if (includeHistory) {
            response.data.history = await earningsService.getEarningsHistory(historyLimit);
        }

        res.json(response);
    } catch (err) {
        console.error('[earnings] getEarnings error:', err);
        res.status(500).json({
            success: false,
            error: 'server_error',
            message: err.message
        });
    }
}

module.exports = {
    getEarnings
};
