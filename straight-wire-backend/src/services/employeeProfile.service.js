'use strict';

const { auth, db } = require('../firebase');
const { appError } = require('../utils/errors');

const ACTIVE_FOR_CLIENT = ['assigned', 'awaiting_client_ok', 'pending_boss_close', 'closed'];

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

async function getEmployeeProfile(employeeUid, options = {}) {
  if (typeof employeeUid !== 'string' || employeeUid.trim() === '') {
    throw appError(400, 'invalid_payload', 'employeeUid is required.');
  }
  const uid = employeeUid.trim();

  if (options.requesterUid && options.requestId) {
    const reqSnap = await db.collection('clientRequests').doc(options.requestId).get();
    if (!reqSnap.exists) throw appError(404, 'not_found', 'Request not found');
    const data = reqSnap.data() || {};
    if (data.clientUid !== options.requesterUid || data.assignedTo !== uid || data.status === 'open') {
      throw appError(403, 'forbidden', 'Forbidden');
    }
  } else if (options.requesterUid && options.requesterRole === 'client') {
    const snap = await db
      .collection('clientRequests')
      .where('clientUid', '==', options.requesterUid)
      .where('assignedTo', '==', uid)
      .where('status', 'in', ACTIVE_FOR_CLIENT)
      .limit(1)
      .get();
    if (snap.empty) throw appError(403, 'forbidden', 'Forbidden');
  }

  const profileRef = db.collection('employees').doc(uid);
  const profileSnap = await profileRef.get();
  const profile = profileSnap.exists ? profileSnap.data() || {} : {};

  let userProfile = {};
  try {
    const userSnap = await db.collection('users').doc(uid).get();
    userProfile = userSnap.exists ? (userSnap.data() || {}) : {};
  } catch (err) {
    console.warn('[employeeProfile] users lookup failed', err);
  }

  let authUser = null;
  try {
    authUser = await auth.getUser(uid);
  } catch (_) {
    // Ignore missing auth user and keep DB fallbacks.
  }

  const resolvedName = pickBestName(
    profile.displayName,
    profile.name,
    userProfile.name,
    userProfile.displayName,
    authUser?.displayName,
    userProfile.email,
    authUser?.email,
  );

  const resolvedPhoto = cleanString(
    profile.photoUrl ||
    profile.photoURL ||
    userProfile.profilePhoto ||
    userProfile.photoUrl ||
    authUser?.photoURL
  );

  const resolvedEmail = cleanString(userProfile.email || authUser?.email);

  return {
    uid,
    name: resolvedName || null,
    displayName: resolvedName || null,
    email: resolvedEmail || null,
    photoUrl: resolvedPhoto || null,
    phone: profile.phone || userProfile.phone || null,
    title: profile.title || null,
    bio: profile.bio || null,
    experienceYears: profile.experienceYears || null,
    completedJobsCount: profile.completedJobsCount || null,
    ratingAvg: profile.ratingAvg || null,
  };
}

module.exports = {
  getEmployeeProfile,
};
