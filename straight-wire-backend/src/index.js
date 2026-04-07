'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { loadBackendEnv } = require('./config/env');
const { buildHelmetOptions } = require('./config/security');
const { createLogger } = require('./utils/logger');

const logger = createLogger('startup');

const envState = loadBackendEnv();
if (!envState.loadedFiles.length) {
  logger.warn('No .env files loaded. Expected one of:', envState.envFiles.join(', '));
} else {
  logger.info('Loaded env files:', envState.loadedFiles.join(', '));
}

/* =========================
   2) Initialize Firebase Admin (AFTER dotenv)
========================= */
require('./firebase');

/* =========================
   3) Imports
========================= */
const express = require('express');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const { Server } = require('socket.io');
const { auth, db } = require('./firebase');
const { buildCorsOptions, buildSocketCorsOptions, resolveAllowedOrigins } = require('./config/httpSecurity');
const { createFirebaseAuthProxyMiddleware } = require('./middleware/firebaseAuthProxy');
const { attachRequestContext, logRequests } = require('./middleware/requestContext');

/* =========================
   4) Validate PORT
========================= */
if (!process.env.PORT) {
  logger.error('Missing required environment variable: PORT');
  process.exit(1);
}

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0) {
  logger.error(`Invalid PORT value "${process.env.PORT}"`);
  process.exit(1);
}
const isDev = process.env.NODE_ENV !== 'production';

/* =========================
   5) Initialize Express
========================= */
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const allowedOrigins = resolveAllowedOrigins({ isDevelopment: isDev });

const server = http.createServer(app);
const io = new Server(server, {
  cors: buildSocketCorsOptions({ allowedOrigins }),
});
app.set('io', io);

/* =========================
   6) Global middlewares
========================= */
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});
app.use(attachRequestContext);
app.use(logRequests);
app.use(createFirebaseAuthProxyMiddleware());

// Keep a CSP compatible with the current frontend while still restoring basic browser protections.
app.use(
  helmet(
    buildHelmetOptions({
      isDevelopment: isDev,
    }),
  ),
);
app.use(cors(buildCorsOptions({ allowedOrigins })));
app.use(express.json({ limit: '1mb' }));

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'rate_limited',
    message: 'Too many requests. Try again later.',
  },
});

/* =========================
   6.25) Frontend static (single tunnel support)
========================= */
const webRoot = path.resolve(__dirname, '..', '..');
const assetsDir = path.join(webRoot, 'assets');
const hostVanillaDir = path.join(webRoot, 'host-vanilla');
const builderDistDir = path.join(webRoot, 'builder-react', 'dist');
const engineDistDir = path.join(webRoot, 'engine', 'dist');
const htmlFiles = new Set();

try {
  for (const file of fs.readdirSync(webRoot)) {
    if (typeof file === 'string' && file.toLowerCase().endsWith('.html')) {
      htmlFiles.add(file);
    }
  }
} catch (err) {
  logger.warn('Failed to read web root:', { error: err && err.message ? err.message : err });
}

app.use('/assets', express.static(assetsDir));
app.use('/host-vanilla', express.static(hostVanillaDir));
app.use('/builder-react/dist', express.static(builderDistDir));
app.use('/engine/dist', express.static(engineDistDir));

function hasHtmlFile(filename) {
  if (htmlFiles.has(filename)) return true;
  const fullPath = path.join(webRoot, filename);
  if (!fullPath.startsWith(webRoot)) return false;
  if (!fs.existsSync(fullPath)) return false;
  htmlFiles.add(filename);
  return true;
}

async function sendHtmlWithNonce(res, filePath) {
  const rawHtml = await fs.promises.readFile(filePath, 'utf8');
  const nonceAttr = ` nonce="${res.locals.cspNonce}"`;
  const withNonce = rawHtml
    .replace(/<script\b(?![^>]*\bnonce=)/gi, `<script${nonceAttr}`)
    .replace(/<style\b(?![^>]*\bnonce=)/gi, `<style${nonceAttr}`);

  res.type('html');
  return res.send(withNonce);
}

app.get(/\/[^/]+\.html$/, (req, res, next) => {
  const parts = req.path.split('/').filter(Boolean);
  if (parts.length !== 1) return next();
  const filename = parts[0];
  if (!hasHtmlFile(filename)) return next();
  sendHtmlWithNonce(res, path.join(webRoot, filename)).catch(next);
});

/* =========================
   6.5) Socket.IO
========================= */
io.use(async (socket, next) => {
  const token = socket.handshake?.auth?.token;
  if (!token) {
    if (isDev) logger.warn('socket Missing auth token.');
    return next(new Error('unauthorized'));
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    if (!decoded.role && decoded.uid) {
      try {
        const snap = await db.collection('users').doc(decoded.uid).get();
        if (snap.exists) {
          const data = snap.data() || {};
          if (typeof data.role === 'string' && data.role.trim() !== '') {
            decoded.role = data.role.trim();
          }
      }
    } catch (err) {
        if (isDev) logger.warn('socket Failed to resolve role from Firestore:', err);
      }
    }
    socket.user = decoded;
    return next();
  } catch (err) {
    if (isDev) logger.warn('socket Token verification failed:', err && err.code ? err.code : err);
    return next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  const role = socket.user && socket.user.role;
  if (role === 'employee' || role === 'boss') {
    socket.join('employees');
  }

  socket.on('job:join', (jobId) => {
    if (typeof jobId !== 'string') return;
    const trimmed = jobId.trim();
    if (!trimmed) return;
    socket.join(`job:${trimmed}`);
  });
});

/* =========================
   7) Safe router loader
========================= */
function asRouter(moduleExport, label) {
  if (typeof moduleExport === 'function') return moduleExport;
  if (moduleExport && typeof moduleExport.router === 'function') return moduleExport.router;
  if (moduleExport && typeof moduleExport.default === 'function') return moduleExport.default;

  logger.warn(`"${label}" does not export an Express router; mounting empty placeholder.`);
  return express.Router();
}

/* =========================
   8) Middlewares
========================= */
const verifyFirebaseToken = require('./middleware/verifyFirebaseToken');
const requireRole = require('./middleware/requireRole');
const { verifyFirebaseIdToken, employeeOnly } = require('./middleware/authMiddleware');

/* =========================
   9) Routes (frontend contract)
========================= */
const healthRoutes = asRouter(require('./routes/health.routes'), 'health.routes.js');
const authRoutes = asRouter(require('./routes/auth.routes'), 'auth.routes.js');
const publicRoutes = asRouter(require('./routes/public.routes'), 'public.routes.js');
const bossRoutes = asRouter(require('./routes/boss.routes'), 'boss.routes.js');
const employeeRoutes = asRouter(require('./routes/employee.routes'), 'employee.routes.js');
const clientRoutes = asRouter(require('./routes/client.routes'), 'client.routes.js');
const employeeJobsRoutes = asRouter(require('./routes/employeeJobs.routes'), 'employeeJobs.routes.js');
const apiRoutes = asRouter(require('./routes/api.routes'), 'api.routes.js');
const mobileRoutes = asRouter(require('./routes/mobile.routes'), 'mobile.routes.js');
const marketplaceRoutes = asRouter(require('./routes/marketplace.routes'), 'marketplace.routes.js');
const builderRoutes = asRouter(require('./routes/builder.routes'), 'builder.routes.js');
const materialsRoutes = asRouter(require('./routes/materials.routes'), 'materials.routes.js');
const recipesRoutes = asRouter(require('./routes/recipes.routes'), 'recipes.routes.js');
const invoiceRoutes = asRouter(require('./routes/invoice.routes'), 'invoice.routes.js');
const uploadsRoutes = asRouter(require('./routes/uploads.routes'), 'uploads.routes.js');
const whatsappWebhookRoutes = asRouter(require('./routes/whatsappWebhook.routes'), 'whatsappWebhook.routes.js');

/* =========================
   10) Route mounting
========================= */
app.use(['/auth', '/public', '/client', '/employee', '/boss', '/api'], apiRateLimiter);

app.use('/', healthRoutes); // GET /health
app.use('/auth', authRoutes);
app.use('/public', publicRoutes);
app.use('/client', clientRoutes);
app.use('/employee', employeeRoutes);
app.use('/boss', verifyFirebaseToken, requireRole('boss'), bossRoutes);
app.use('/api/employee', employeeJobsRoutes);
app.use('/api/hooks/whatsapp', whatsappWebhookRoutes);
app.use('/api', apiRoutes);
app.use('/api/mobile', verifyFirebaseToken, requireRole.requireMobileUser, mobileRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/builder', builderRoutes);
app.use('/api/builder/materials', materialsRoutes);
app.use('/api/builder/recipes', recipesRoutes);
app.use('/api/builder/invoices', invoiceRoutes);

// Employee profile routes (public for clients to view)
const employeeProfileRoutes = asRouter(require('./routes/employee-profile.routes'), 'employee-profile.routes.js');
app.use('/api/employees', employeeProfileRoutes);

app.use('/api/boss', verifyFirebaseToken, requireRole('boss'), bossRoutes);
app.use('/api/client', clientRoutes);
app.get('/api/employee/me', verifyFirebaseIdToken, employeeOnly, (req, res) => {
  return res.status(200).json({
    id: req.user.uid,
    email: req.user.email,
    role: req.user.role,
  });
});

logger.info('Routers mounted:', [
  'GET /health',
  '/auth',
  '/public',
  '/client',
  '/employee',
  '/boss (protected)',
  '/api/client',
  '/api/employee (jobs)',
  '/api/hooks/whatsapp',
  '/api (protected mix)',
  '/api/mobile (protected staff)',
  '/api/marketplace',
  'GET /api/employee/me',
]);

/* =========================
   11) Root endpoint
========================= */
app.get('/', (req, res) => {
  const acceptsHtml = (req.headers.accept || '').includes('text/html');
  if (acceptsHtml && hasHtmlFile('index.html')) {
    sendHtmlWithNonce(res, path.join(webRoot, 'index.html')).catch((err) => {
      logger.error('Failed to serve index.html with nonce:', err);
      res.status(500).json({
        error: 'internal_error',
        message: 'Internal Server Error',
      });
    });
    return;
  }

  return res.status(200).json({
    status: 'active',
    service: 'Straight Wire Electric CRM Backend',
  });
});

/* =========================
   12) Error handling (frontend contract)
========================= */
app.use((req, res) => {
  return res.status(404).json({
    error: 'not_found',
    message: 'Resource not found.',
  });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    requestId: req && req.requestId ? req.requestId : null,
  }, err);

  // Check for Firestore missing index error FIRST
  const { isFirestoreIndexRequiredError } = require('./utils/errors');
  if (isFirestoreIndexRequiredError(err)) {
    logger.error('Firestore index required - deploy indexes!');
    return res.status(409).json({
      ok: false,
      error: 'missing_index',
      message: 'Firestore requiere índice compuesto para esta consulta.',
      hint: 'firebase deploy --only firestore:indexes',
    });
  }

  const status = err && typeof err.status === 'number' ? err.status : 500;

  // Normalize invalid JSON/body errors to the frontend contract.
  const isInvalidJson =
    status === 400 &&
    (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large' || err instanceof SyntaxError));

  if (isInvalidJson) {
    return res.status(400).json({
      error: 'invalid_payload',
      message: 'Invalid request body.',
    });
  }

  const error = err && typeof err.code === 'string' ? err.code : 'internal_error';
  const message = status >= 500 ? 'Internal Server Error' : err.message || 'Request failed.';

  return res.status(status).json({
    error: String(error).toLowerCase(),
    message,
    requestId: req && req.requestId ? req.requestId : undefined,
  });
});

/* =========================
   13) Start server
========================= */
server.listen(port, () => {
  logger.info(`API server listening on port ${port}`);
});
