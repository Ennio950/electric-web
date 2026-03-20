import { auth, db } from "./firebase.js";
import { getIdTokenResult } from "../vendor/firebase/firebase-auth.js";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "../vendor/firebase/firebase-firestore.js";

const PRO_ACTIONS = new Set([
  "SAVE_TEMPLATE",
  "GENERATE_ESTIMATE",
  "EXPORT"
]);
const PRO_FALLBACK_EMAILS = new Set([
  "enniotriguerospagos@gmail.com"
]);

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toBool(value) {
  if (value === true) return true;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
  }
  return false;
}

function hasTruthyProPermission(source) {
  const obj = asObject(source);
  if (!obj || !Object.keys(obj).length) return false;

  const directCandidates = [
    obj.proActions,
    obj.pro_actions,
    obj.proactions,
    obj.proAction
  ];
  if (directCandidates.some((value) => toBool(value))) return true;

  const normalizedKeys = Object.entries(obj);
  for (const [rawKey, rawValue] of normalizedKeys) {
    const key = String(rawKey || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key) continue;
    if (key === "proactions" || key === "proaction" || key === "professionalactions") {
      if (toBool(rawValue)) return true;
    }
  }

  return false;
}

function isFallbackProUser(user, profileDoc = {}) {
  const email = String(user?.email || profileDoc.email || "").trim().toLowerCase();
  return !!email && PRO_FALLBACK_EMAILS.has(email);
}

function normalizeMetadata(metadata) {
  const source = asObject(metadata);
  const normalized = {};
  const entries = Object.entries(source).slice(0, 24);
  for (const [rawKey, rawValue] of entries) {
    const key = String(rawKey || "").trim().slice(0, 64);
    if (!key) continue;
    if (rawValue == null) continue;
    if (typeof rawValue === "string") {
      normalized[key] = rawValue.slice(0, 600);
      continue;
    }
    if (typeof rawValue === "number" || typeof rawValue === "boolean") {
      normalized[key] = rawValue;
      continue;
    }
    if (Array.isArray(rawValue)) {
      normalized[key] = rawValue.map((item) => {
        if (item == null) return "";
        if (typeof item === "number" || typeof item === "boolean") return item;
        return String(item).slice(0, 120);
      }).slice(0, 20);
      continue;
    }
    normalized[key] = String(rawValue).slice(0, 240);
  }
  return normalized;
}

function profileFromSources(user, tokenClaims, userDocData) {
  const claims = asObject(tokenClaims);
  const profileDoc = asObject(userDocData);
  const docPermissions = asObject(profileDoc.permissions);
  const claimPermissions = asObject(claims.permissions);
  const proFromClaims = hasTruthyProPermission(claims) || hasTruthyProPermission(claimPermissions);
  const proFromDoc = hasTruthyProPermission(profileDoc) || hasTruthyProPermission(docPermissions);
  const proFromFallback = isFallbackProUser(user, profileDoc);

  return {
    uid: user?.uid || "",
    email: user?.email || profileDoc.email || "",
    displayName: user?.displayName || profileDoc.displayName || profileDoc.name || "",
    role: profileDoc.role || claims.role || "employee",
    permissions: {
      ...claimPermissions,
      ...docPermissions,
      proActions: proFromDoc || proFromClaims || proFromFallback
    },
    source: {
      hasUserDoc: !!profileDoc && Object.keys(profileDoc).length > 0
    }
  };
}

export async function getCurrentUserProfile(explicitUser = null) {
  const user = explicitUser || auth.currentUser;
  if (!user) {
    return {
      uid: "",
      email: "",
      displayName: "",
      role: "guest",
      permissions: { proActions: false },
      source: { hasUserDoc: false }
    };
  }

  let tokenClaims = {};
  let userDocData = {};

  try {
    const tokenResult = await getIdTokenResult(user, false);
    tokenClaims = tokenResult?.claims || {};
  } catch (_) {
    tokenClaims = {};
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) userDocData = snap.data() || {};
  } catch (_) {
    userDocData = {};
  }

  return profileFromSources(user, tokenClaims, userDocData);
}

export function canSeeProActions(profile) {
  return toBool(profile?.permissions?.proActions);
}

export async function requireProActionsAccess(options = {}) {
  const {
    profile = null,
    redirectTo = "panel-empleado.html",
    showAlert = true
  } = options;

  const resolvedProfile = profile || await getCurrentUserProfile();
  const allowed = canSeeProActions(resolvedProfile);
  if (allowed) return { allowed: true, profile: resolvedProfile };

  if (showAlert) {
    alert("No autorizado");
  }
  if (redirectTo) {
    window.location.href = redirectTo;
  }
  return { allowed: false, profile: resolvedProfile };
}

export async function logProAction(action, metadata = {}) {
  const normalizedAction = String(action || "").trim().toUpperCase();
  if (!PRO_ACTIONS.has(normalizedAction)) {
    return {
      ok: false,
      error: new Error("Invalid PRO action")
    };
  }

  const user = auth.currentUser;
  if (!user) {
    return {
      ok: false,
      error: new Error("No authenticated user")
    };
  }

  const profile = await getCurrentUserProfile(user);
  const payload = {
    type: "PRO_ACTION",
    action: normalizedAction,
    actorUid: user.uid,
    actorEmail: user.email || profile.email || "",
    role: "employee",
    createdAt: serverTimestamp(),
    metadata: normalizeMetadata({
      route: window.location.pathname || "",
      userAgent: navigator.userAgent || "",
      ...metadata
    })
  };

  try {
    await addDoc(collection(db, "auditLogs"), payload);
    return { ok: true };
  } catch (error) {
    console.warn("[pro-actions] Failed to write audit log:", error);
    return { ok: false, error };
  }
}
