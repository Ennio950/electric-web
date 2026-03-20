import { API_BASE, DEFAULT_TIMEOUT_MS, fetchWithTimeout, getIdTokenForUser } from "./api.js?v=20260310c";
import { establishPortalSession } from "./portal-session.js";
import { createLogger } from "./logger.js";

const logger = createLogger("role-gateway");

const ROLE_ENDPOINTS = [
  { role: "client", path: "/api/client/me", target: "panel-cliente.html", login: "login-gateway.html" },
  { role: "employee", path: "/api/employee/me", target: "panel-empleado.html", login: "login-empleado.html" },
  { role: "boss", path: "/api/boss/me", target: "panel-jefe.html", login: "login-jefe.html" }
];
const ALLOWED_ROLES = ROLE_ENDPOINTS.map((entry) => entry.role);

const LOGIN_GATEWAY_RE = /login|gateway/i;

function pageName(value) {
  const raw = String(value || "");
  const part = raw.split("/").pop() || "";
  return part.split("?")[0].split("#")[0].toLowerCase();
}

function shortBody(body) {
  if (body == null) return "";
  let raw = "";
  try {
    raw = typeof body === "string" ? body : JSON.stringify(body);
  } catch {
    raw = String(body);
  }
  return raw.length > 180 ? `${raw.slice(0, 180)}...` : raw;
}

async function readBody(res) {
  const type = res.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    return res.json().catch(() => null);
  }
  return res.text().catch(() => "");
}

export function getReturnToFromLocation() {
  const params = new URLSearchParams(window.location.search);
  return params.get("returnTo") || "";
}

export function sanitizeReturnTo(returnTo) {
  const raw = String(returnTo || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return "";
  if (LOGIN_GATEWAY_RE.test(raw)) return "";
  return raw;
}

export function pickDestination(role, returnTo) {
  const entry = ROLE_ENDPOINTS.find((r) => r.role === role);
  const safeReturnTo = sanitizeReturnTo(returnTo);
  if (!entry) return safeReturnTo || "index.html";
  if (!safeReturnTo) return entry.target;

  const targetName = pageName(safeReturnTo);
  const otherTargets = ROLE_ENDPOINTS.filter((r) => r.role !== role).map((r) => r.target.toLowerCase());
  if (otherTargets.includes(targetName)) return entry.target;
  return safeReturnTo;
}

export function safeRedirect(target) {
  if (!target) return false;
  const current = pageName(window.location.pathname);
  const targetPage = pageName(target);
  if (current && targetPage && current === targetPage) return false;
  window.location.replace(target);
  return true;
}

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return ALLOWED_ROLES.includes(role) ? role : "";
}

function toRoleResult(role, source = "fallback", body = {}, token = "") {
  const normalizedRole = normalizeRole(role);
  const entry = ROLE_ENDPOINTS.find((item) => item.role === normalizedRole);
  if (!entry) return null;
  return {
    role: entry.role,
    target: entry.target,
    login: entry.login,
    token: typeof token === "string" ? token : "",
    verifiedAt: Date.now(),
    status: 200,
    body: {
      source,
      ...body
    }
  };
}

export async function validateRoleWithBackend(user, options = {}) {
  if (!user) {
    const err = new Error("No active session.");
    err.kind = "auth";
    throw err;
  }

  const debugLabel = options.debugLabel || "[gateway]";
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const expectedRole = normalizeRole(options.expectedRole);
  const endpointsToCheck = expectedRole
    ? ROLE_ENDPOINTS.filter((entry) => entry.role === expectedRole)
    : ROLE_ENDPOINTS;

  let token = null;
  try {
    token = await getIdTokenForUser(user, false);
  } catch (e) {
    logger.warn(`${debugLabel} token refresh failed`, e);
    return null;
  }

  if (!token) {
    logger.warn(`${debugLabel} no token available`);
    return null;
  }

  let transientError = null;

  for (const entry of endpointsToCheck) {
    let res;
    try {
      // Manually constructing fetch to handle errors specifically
      res = await fetchWithTimeout(
        `${API_BASE}${entry.path}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        },
        timeoutMs
      );

      // Handle 401/403 gracefully
      if (res.status === 401 || res.status === 403) {
        logger.warn(`${debugLabel} ${entry.role} check forbidden (${res.status})`);
        continue;
      }

    } catch (err) {
      if (err?.kind === "timeout") {
        transientError = new Error("Timeout");
        transientError.kind = "timeout";
        break;
      }
      if (err?.kind === "network") {
        transientError = new Error("Network error");
        transientError.kind = "network";
        break;
      }
      throw err;
    }

    const body = await readBody(res);
    logger.debug(`${debugLabel} backend ${entry.path} status=${res.status}`, shortBody(body));

    if (res.ok) {
      await establishPortalSession(
        {
          role: entry.role,
          token,
          authAt: Date.now(),
        },
        {
          apiBase: API_BASE,
        },
      );

      return {
        role: entry.role,
        target: entry.target,
        login: entry.login,
        token,
        verifiedAt: Date.now(),
        status: res.status,
        body
      };
    }

    if (res.status === 401 || res.status === 403 || res.status === 404) continue;

    const err = new Error(body?.error || body?.message || `Error ${res.status}`);
    err.status = res.status;
    err.body = body;
    err.kind = res.status === 401 ? "auth" : "server";
    throw err;
  }

  if (transientError) throw transientError;

  return null;
}

export function getRoleLogin(role) {
  const entry = ROLE_ENDPOINTS.find((r) => r.role === role);
  return entry?.login || "login-gateway.html";
}
