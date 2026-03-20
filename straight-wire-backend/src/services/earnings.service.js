/**
 * Earnings Service
 * Tracks boss commission (20%) on completed jobs.
 */
const { admin, db } = require('../firebase');

const EARNINGS_COLLECTION = 'earnings';
const COMMISSION_RATE = 0.20; // 20%

// FieldValue for serverTimestamp
const FieldValue = admin.firestore.FieldValue;

/**
 * Record an earning when a payment is approved.
 */
async function recordEarning({ requestId, finalAmount, employeeId, employeeName, employeeEmail, description, address }) {
    const commission = Math.round(finalAmount * COMMISSION_RATE * 100) / 100; // Round to 2 decimals

    const earning = {
        requestId,
        finalAmount,
        commission,
        employeeId: employeeId || null,
        employeeName: employeeName || null,
        employeeEmail: employeeEmail || null,
        description: description || '',
        address: address || '',
        createdAt: FieldValue.serverTimestamp()
    };

    const docRef = await db.collection(EARNINGS_COLLECTION).add(earning);
    console.log('[earnings] Recorded earning:', docRef.id, 'commission:', commission);

    return {
        id: docRef.id,
        ...earning,
        commission
    };
}

/**
 * Get earnings summary by period.
 * Returns: { today, thisWeek, thisMonth, total }
 */
async function getEarningsSummary() {
    const now = new Date();

    // Start of today (midnight)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Start of this week (Monday)
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);

    // Start of this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get all earnings
    const snap = await db.collection(EARNINGS_COLLECTION)
        .orderBy('createdAt', 'desc')
        .get();

    let today = 0;
    let thisWeek = 0;
    let thisMonth = 0;
    let total = 0;

    snap.forEach(doc => {
        const data = doc.data();
        const commission = data.commission || 0;
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);

        total += commission;

        if (createdAt >= startOfMonth) {
            thisMonth += commission;
        }
        if (createdAt >= startOfWeek) {
            thisWeek += commission;
        }
        if (createdAt >= startOfToday) {
            today += commission;
        }
    });

    return {
        today: Math.round(today * 100) / 100,
        thisWeek: Math.round(thisWeek * 100) / 100,
        thisMonth: Math.round(thisMonth * 100) / 100,
        total: Math.round(total * 100) / 100,
        count: snap.size
    };
}

/**
 * Get earnings history (detailed list).
 */
async function getEarningsHistory(limitCount = 50) {
    const snap = await db.collection(EARNINGS_COLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(limitCount)
        .get();

    return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null
    }));
}

module.exports = {
    recordEarning,
    getEarningsSummary,
    getEarningsHistory,
    COMMISSION_RATE
};
