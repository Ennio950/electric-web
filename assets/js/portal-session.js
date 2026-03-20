export const PORTAL_ROLE_KEY = "swe:portalRole";
export const PORTAL_AUTH_TS_KEY = "swe:portalAuthAt";
export const PORTAL_CSRF_COOKIE = "swe_portal_csrf";
const PORTAL_SESSION_TIMEOUT_MS = 5000;

import { getApiBase } from "./runtime-config.js";
import { createLogger } from "./logger.js";

const logger = createLogger("portal-session");

export function normalizePortalRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return role === "employee" || role === "boss" || role === "client" ? role : "";
}

function resolveApiBase(explicitBase = "") {
  const raw = String(explicitBase || "").trim();
  return raw || getApiBase(window);
}

function normalizeMethod(method = "GET") {
  return String(method || "GET").trim().toUpperCase();
}

function readCookie(name, doc = document) {
  const target = String(name || "").trim();
  if (!target || !doc || typeof doc.cookie !== "string") return "";

  return doc.cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((found, part) => {
      if (found) return found;

      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) return "";

      const key = part.slice(0, separatorIndex).trim();
      if (key !== target) return "";

      const value = part.slice(separatorIndex + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch (_) {
        return value;
      }
    }, "");
}

export function getPortalCsrfToken(doc = document) {
  return readCookie(PORTAL_CSRF_COOKIE, doc);
}

export function withPortalCsrfHeaders(headers = {}, doc = document) {
  const nextHeaders = new Headers(headers);
  const csrfToken = getPortalCsrfToken(doc);

  if (csrfToken) {
    nextHeaders.set("X-CSRF-Token", csrfToken);
  }

  return nextHeaders;
}

async function fetchPortalSession(path, options = {}, apiBase = "") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PORTAL_SESSION_TIMEOUT_MS);
  const method = normalizeMethod(options.method);
  const requestOptions = {
    ...options,
    credentials: "include",
    signal: controller.signal,
  };

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    requestOptions.headers = withPortalCsrfHeaders(options.headers);
  }

  try {
    return await fetch(`${resolveApiBase(apiBase)}${path}`, {
      ...requestOptions,
    });
  } finally {
    clearTimeout(timer);
  }
}

export function setPortalSession(session = {}) {
  const role = normalizePortalRole(session.role);
  const authAt = Number.isFinite(Number(session.authAt)) ? Number(session.authAt) : Date.now();

  try {
    if (role) {
      localStorage.setItem(PORTAL_ROLE_KEY, role);
      localStorage.setItem(PORTAL_AUTH_TS_KEY, String(authAt));
    } else {
      localStorage.removeItem(PORTAL_ROLE_KEY);
      localStorage.removeItem(PORTAL_AUTH_TS_KEY);
    }
  } catch (_) {
    // ignore storage restrictions
  }
}

export async function establishPortalSession(session = {}, options = {}) {
  const role = normalizePortalRole(session.role);
  const token = typeof session.token === "string" ? session.token.trim() : "";
  const authAt = Number.isFinite(Number(session.authAt)) ? Number(session.authAt) : Date.now();
  const apiBase = options.apiBase || "";

  if (!role || !token) {
    throw new Error("Portal session requires role and token.");
  }

  const response = await fetchPortalSession(
    "/auth/portal-session",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role }),
    },
    apiBase,
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body?.message || "No se pudo crear la sesion del portal.");
    error.status = response.status;
    throw error;
  }

  setPortalSession({ role, authAt });
  return getPortalSession();
}

export async function clearPortalSession(options = {}) {
  const revoke = options.revoke === true;
  const apiBase = options.apiBase || "";

  try {
    localStorage.removeItem(PORTAL_ROLE_KEY);
    localStorage.removeItem(PORTAL_AUTH_TS_KEY);
  } catch (_) {
    // ignore storage restrictions
  }

  if (!revoke) return true;

  try {
    await fetchPortalSession(
      "/auth/portal-session",
      {
        method: "DELETE",
      },
      apiBase,
    );
    return true;
  } catch (error) {
    logger.warn("Failed to revoke portal session cookie", error);
    return false;
  }
}

export function getPortalSession() {
  try {
    return {
      role: normalizePortalRole(localStorage.getItem(PORTAL_ROLE_KEY)),
      authAt: Number.parseInt(localStorage.getItem(PORTAL_AUTH_TS_KEY) || "", 10),
    };
  } catch (_) {
    return {
      role: "",
      authAt: 0,
    };
  }
}

export async function syncPortalSessionFromUser(user, role, options = {}) {
  const normalizedRole = normalizePortalRole(role);
  if (!user || !normalizedRole) {
    clearPortalSession();
    return null;
  }

  const nextSession = {
    role: normalizedRole,
    authAt: Date.now(),
  };

  try {
    const forceRefresh = options.forceRefresh === true;
    const token = await user.getIdToken(forceRefresh);
    await establishPortalSession(
      {
        ...nextSession,
        token,
      },
      options,
    );
  } catch (error) {
    logger.warn("Failed to refresh ID token for portal session", error);
    setPortalSession(nextSession);
    return getPortalSession();
  }

  return getPortalSession();
}
