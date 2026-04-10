'use strict';

function uniqueDirectiveValues(values) {
  const seen = new Set();
  const output = [];

  for (const value of values) {
    if (!value) continue;

    if (typeof value !== 'string') {
      output.push(value);
      continue;
    }

    if (seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }

  return output;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeSource(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function splitSources(value) {
  return unique(
    String(value || '')
      .split(/[,\s]+/)
      .map(normalizeSource),
  );
}

function buildCspDirectives(options = {}) {
  const extraConnectSrc = splitSources(options.extraConnectSrc || process.env.CSP_CONNECT_SRC_EXTRA);
  const extraScriptSrc = splitSources(options.extraScriptSrc || process.env.CSP_SCRIPT_SRC_EXTRA);
  const extraStyleSrc = splitSources(options.extraStyleSrc || process.env.CSP_STYLE_SRC_EXTRA);
  const isDevelopment = options.isDevelopment === true;
  const nonceDirective =
    options.nonce === true
      ? (req, res) => `'nonce-${res.locals.cspNonce}'`
      : typeof options.nonce === 'string' && options.nonce.trim() !== ''
        ? `'nonce-${options.nonce.trim()}'`
        : typeof options.nonce === 'function'
          ? options.nonce
          : null;

  const connectSrc = unique([
    "'self'",
    'https:',
    'ws:',
    'wss:',
    ...extraConnectSrc,
  ]);

  if (isDevelopment) {
    connectSrc.push('http://127.0.0.1:5173', 'http://127.0.0.1:5174');
  }

  return {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'self'"],
    objectSrc: ["'none'"],
    scriptSrc: uniqueDirectiveValues([
      "'self'",
      nonceDirective,
      'https://apis.google.com',
      ...extraScriptSrc,
    ]),
    styleSrc: unique([
      "'self'",
      "'unsafe-inline'",
      ...extraStyleSrc,
    ]),
    scriptSrcAttr: ["'none'"],
    styleSrcAttr: ["'unsafe-inline'"],
    fontSrc: ["'self'", 'data:'],
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    connectSrc,
    frameSrc: ["'self'", 'https://*.firebaseapp.com', 'https://apis.google.com'],
    workerSrc: ["'self'", 'blob:'],
    mediaSrc: ["'self'", 'blob:', 'https:'],
  };
}

function buildHelmetOptions(options = {}) {
  return {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: buildCspDirectives({
        ...options,
        nonce: options.nonce !== false,
      }),
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: {
      policy: 'same-origin-allow-popups',
    },
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
  };
}

module.exports = {
  buildCspDirectives,
  buildHelmetOptions,
  splitSources,
};
