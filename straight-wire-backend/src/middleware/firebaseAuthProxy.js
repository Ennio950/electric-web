'use strict';

const https = require('https');

const DEFAULT_FIREBASE_AUTH_PROXY_HOST = 'straight-wire-electric.firebaseapp.com';

function normalizeHost(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function resolveProxyHost(value) {
  return normalizeHost(value) || DEFAULT_FIREBASE_AUTH_PROXY_HOST;
}

function shouldProxyFirebaseAuthPath(pathname = '') {
  return pathname === '/__/firebase/init.json' || pathname === '/__/auth' || pathname.startsWith('/__/auth/');
}

function buildFirebaseProxyPath(originalUrl = '/') {
  const url = new URL(originalUrl, 'http://localhost');
  if (!shouldProxyFirebaseAuthPath(url.pathname)) {
    throw new Error(`Unsupported Firebase auth proxy path: ${url.pathname}`);
  }

  return `${url.pathname}${url.search}`;
}

function buildProxyHeaders(req, proxyHost) {
  const headers = { ...req.headers };
  headers.host = proxyHost;
  headers['x-forwarded-host'] = req.headers.host || '';
  headers['x-forwarded-proto'] = req.protocol || 'https';
  return headers;
}

function createFirebaseAuthProxyMiddleware(options = {}) {
  const proxyHost = resolveProxyHost(options.host || process.env.FIREBASE_AUTH_PROXY_HOST);

  return function firebaseAuthProxyMiddleware(req, res, next) {
    if (!shouldProxyFirebaseAuthPath(req.path)) {
      return next();
    }

    let proxyPath;
    try {
      proxyPath = buildFirebaseProxyPath(req.originalUrl || req.url || '/');
    } catch (err) {
      return next(err);
    }

    const proxyReq = https.request(
      {
        protocol: 'https:',
        hostname: proxyHost,
        method: req.method,
        path: proxyPath,
        headers: buildProxyHeaders(req, proxyHost),
      },
      (proxyRes) => {
        res.status(proxyRes.statusCode || 502);

        for (const [headerName, headerValue] of Object.entries(proxyRes.headers)) {
          if (typeof headerValue === 'undefined') continue;
          res.setHeader(headerName, headerValue);
        }

        proxyRes.pipe(res);
      },
    );

    proxyReq.on('error', (err) => {
      err.status = 502;
      next(err);
    });

    if (req.method === 'GET' || req.method === 'HEAD') {
      proxyReq.end();
      return;
    }

    req.pipe(proxyReq);
  };
}

module.exports = {
  DEFAULT_FIREBASE_AUTH_PROXY_HOST,
  buildFirebaseProxyPath,
  createFirebaseAuthProxyMiddleware,
  resolveProxyHost,
  shouldProxyFirebaseAuthPath,
};
