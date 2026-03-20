export const API_BASE_STORAGE_KEY = "API_BASE_URL";
export const API_BASE_QUERY_KEYS = ["api", "apiBase", "api_base"];
export const DEFAULT_LOCAL_API_BASE = "http://127.0.0.1:8081";
export const LOCAL_API_FALLBACK_PORTS = new Set(["5500", "5501", "5502", "5503"]);

export function normalizeBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "null" || raw === "undefined") return "";
  return raw.replace(/\/+$/, "");
}

export function getQueryApiBase(search = "") {
  const params = new URLSearchParams(search || "");
  for (const key of API_BASE_QUERY_KEYS) {
    const value = normalizeBaseUrl(params.get(key));
    if (value) return value;
  }
  return "";
}

export function resolveApiBaseFromLocation({
  location = {},
  storedApiBase = "",
  queryApiBase = "",
  fallbackLocalApi = DEFAULT_LOCAL_API_BASE,
  localFallbackPorts = LOCAL_API_FALLBACK_PORTS,
} = {}) {
  const explicitBase = normalizeBaseUrl(queryApiBase);
  if (explicitBase) return explicitBase;

  const storedBase = normalizeBaseUrl(storedApiBase);
  if (storedBase) return storedBase;

  const hostname = String(location.hostname || "");
  const port = String(location.port || "");
  const protocol = String(location.protocol || "");
  const origin = normalizeBaseUrl(location.origin);
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const isLocalFallbackPort = localFallbackPorts instanceof Set
    ? localFallbackPorts.has(port)
    : Array.isArray(localFallbackPorts) && localFallbackPorts.includes(port);

  if ((isLocalhost && isLocalFallbackPort) || protocol === "file:" || !origin) {
    return normalizeBaseUrl(fallbackLocalApi);
  }

  return origin;
}

export function persistApiBase(win, apiBase) {
  const normalized = normalizeBaseUrl(apiBase);
  if (!win || !normalized) return normalized;

  win.API_BASE_URL = normalized;
  try {
    win.localStorage?.setItem(API_BASE_STORAGE_KEY, normalized);
  } catch (_) {
    // ignore storage restrictions
  }
  return normalized;
}

export function initializeRuntimeConfig(win = typeof window !== "undefined" ? window : undefined) {
  if (!win) return normalizeBaseUrl(DEFAULT_LOCAL_API_BASE);

  const queryApiBase = getQueryApiBase(win.location?.search || "");
  if (queryApiBase) {
    return persistApiBase(win, queryApiBase);
  }

  const runtimeBase = normalizeBaseUrl(win.API_BASE_URL);
  if (runtimeBase) return runtimeBase;

  let storedApiBase = "";
  try {
    storedApiBase = normalizeBaseUrl(win.localStorage?.getItem(API_BASE_STORAGE_KEY) || "");
  } catch (_) {
    storedApiBase = "";
  }

  const resolved = resolveApiBaseFromLocation({
    location: win.location || {},
    storedApiBase,
  });

  win.API_BASE_URL = resolved;
  return resolved;
}

export function getApiBase(win = typeof window !== "undefined" ? window : undefined) {
  if (!win) return normalizeBaseUrl(DEFAULT_LOCAL_API_BASE);
  return normalizeBaseUrl(win.API_BASE_URL) || initializeRuntimeConfig(win);
}

