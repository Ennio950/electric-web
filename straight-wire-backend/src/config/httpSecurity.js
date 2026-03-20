'use strict';

const DEV_ALLOWED_ORIGINS = Object.freeze([
  'http://127.0.0.1:8081',
  'http://localhost:8081',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5174',
  'http://localhost:5174',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
]);
const DEV_DYNAMIC_ORIGIN_MARKER = '__dev_dynamic_tunnel_origin__';
const DEV_ALLOWED_DYNAMIC_ORIGIN_PATTERNS = Object.freeze([
  /^https:\/\/[a-z0-9-]+\.ngrok-free\.dev$/i,
  /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/i,
  /^https:\/\/[a-z0-9-]+\.ngrok\.io$/i,
  /^https:\/\/[a-z0-9-]+\.ngrok\.app$/i,
  /^https:\/\/[a-z0-9-]+\.ngrok\.dev$/i,
]);

function normalizeOrigin(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';

  try {
    return new URL(raw).origin.toLowerCase();
  } catch (_) {
    return '';
  }
}

function splitOrigins(value) {
  return Array.from(
    new Set(
      String(value || '')
        .split(/[,\s]+/)
        .map(normalizeOrigin)
        .filter(Boolean),
    ),
  );
}

function uniqueOrigins(values) {
  return Array.from(new Set(values.flatMap((value) => {
    if (value === DEV_DYNAMIC_ORIGIN_MARKER) return [DEV_DYNAMIC_ORIGIN_MARKER];
    const normalized = normalizeOrigin(value);
    return normalized ? [normalized] : [];
  })));
}

function resolveAllowedOrigins(options = {}) {
  const isDevelopment = options.isDevelopment === true;
  const appBaseUrl = options.appBaseUrl || process.env.APP_BASE_URL;
  const explicitOrigins = options.explicitOrigins || process.env.CORS_ALLOWED_ORIGINS;
  const derived = [];

  if (appBaseUrl) derived.push(appBaseUrl);
  if (explicitOrigins) derived.push(...splitOrigins(explicitOrigins));
  if (isDevelopment) {
    derived.push(...DEV_ALLOWED_ORIGINS);
    derived.push(DEV_DYNAMIC_ORIGIN_MARKER);
  }

  return uniqueOrigins(derived);
}

function isDynamicDevelopmentOrigin(origin, allowedOrigins) {
  if (!Array.isArray(allowedOrigins) || !allowedOrigins.includes(DEV_DYNAMIC_ORIGIN_MARKER)) {
    return false;
  }

  return DEV_ALLOWED_DYNAMIC_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return true;
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;
  return allowedOrigins.includes(normalizedOrigin) || isDynamicDevelopmentOrigin(normalizedOrigin, allowedOrigins);
}

function createOriginCallback(allowedOrigins) {
  return (origin, callback) => {
    if (isOriginAllowed(origin, allowedOrigins)) {
      return callback(null, origin || true);
    }

    const err = new Error('Origin not allowed by CORS.');
    err.status = 403;
    err.code = 'cors_not_allowed';
    return callback(err);
  };
}

function buildCorsOptions(options = {}) {
  const allowedOrigins = options.allowedOrigins || resolveAllowedOrigins(options);

  return {
    origin: createOriginCallback(allowedOrigins),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 60 * 60,
  };
}

function buildSocketCorsOptions(options = {}) {
  const allowedOrigins = options.allowedOrigins || resolveAllowedOrigins(options);

  return {
    origin(origin, callback) {
      if (isOriginAllowed(origin, allowedOrigins)) {
        return callback(null, true);
      }

      const err = new Error('Origin not allowed by CORS.');
      err.status = 403;
      err.code = 'cors_not_allowed';
      return callback(err, false);
    },
    credentials: true,
    methods: ['GET', 'POST'],
  };
}

module.exports = {
  buildCorsOptions,
  buildSocketCorsOptions,
  normalizeOrigin,
  resolveAllowedOrigins,
  splitOrigins,
  isOriginAllowed,
};
