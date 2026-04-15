# Straight Wire Electric CRM Backend — Closure Report

Generated: 2026-01-08T19:23:11.6966834-06:00

## Entrypoint
- dev: `npm run dev` -> `nodemon src/index.js`
- server: `http://localhost:8080` (per `.env`)

## Cleanup Plan (executed)
| Candidate | Why | Action | Risk |
|---|---|---|---|
| `src/routes/job.routes.js` | In-memory mock + duplicated paths (`/api/client/jobs`, `/api/boss/jobs`, `/api/employee/jobs`) | Moved to `src/_deprecated/routes/job.routes.mock.js` and removed mount from `src/index.js` | Low (paths now served by role routers) |
| `src/firebase.js` noisy startup log | Global side-effect log on import | Removed `console.log` | Low |

## Files Changed (current workspace state)
Note: repo is not a Git repository, so this list is based on the edits applied in this workspace session.

- Created/Modified: see code section below (all listed files are current source-of-truth).
- Moved to deprecated: `src/_deprecated/routes/job.routes.mock.js`, `src/_deprecated/middlewares/boss.middleware..js`.

## Final Route Map
| Method | URL | Mounted From | Middlewares | Handler | Firestore |
|---|---|---|---|---|---|
| GET | `/` | `src/index.js` | global: helmet/cors/json/morgan/rate-limit | inline | none |
| GET | `/api/health` | `src/routes/health.routes.js` under `/api` | global only | inline | none |
| POST | `/api/admin/bootstrap-boss` | `src/routes/admin.bootstrap.routes.js` under `/api` | `auth` | inline -> `assignUserRole` | `users` |
| POST | `/api/admin/assign-role` | `src/routes/admin.bootstrap.routes.js` under `/api` | `auth` | inline -> `assignUserRole` | `users` |
| GET | `/api/boss/me` | `src/routes/boss.routes.js` under `/api/boss` | `auth`, `requireRole(boss)` | `bossController.getMe` | `users/{uid}` |
| POST | `/api/boss/assign-role` | `src/routes/boss.routes.js` under `/api/boss` | `auth`, `requireRole(boss)` | `bossController.assignRole` | `users/{uid}` |
| GET | `/api/boss/employees` | `src/routes/boss.routes.js` under `/api/boss` | `auth`, `requireRole(boss)` | `bossController.listEmployees` | `users` |
| POST | `/api/boss/employees` | `src/routes/boss.routes.js` under `/api/boss` | `auth`, `requireRole(boss)` | `bossController.createEmployee` | `users`, Firebase Auth |
| GET | `/api/boss/clients` | `src/routes/boss.routes.js` under `/api/boss` | `auth`, `requireRole(boss)` | `bossController.listClients` | `users` |
| POST | `/api/boss/clients` | `src/routes/boss.routes.js` under `/api/boss` | `auth`, `requireRole(boss)` | `bossController.createClient` | `users`, Firebase Auth |
| GET | `/api/boss/jobs` | `src/routes/boss.routes.js` under `/api/boss` | `auth`, `requireRole(boss)` | `bossController.listJobs` | `jobs` |
| PATCH | `/api/boss/jobs/:jobId/assign` | `src/routes/boss.routes.js` under `/api/boss` | `auth`, `requireRole(boss)` | `bossController.assignJob` | `jobs`, `employeeLocks` |
| PATCH | `/api/boss/jobs/:jobId/unassign` | `src/routes/boss.routes.js` under `/api/boss` | `auth`, `requireRole(boss)` | `bossController.unassignJob` | `jobs`, `employeeLocks` |
| GET | `/api/employee/me` | `src/routes/employee.routes.js` under `/api/employee` | `auth`, `requireRole(employee)`, `employeeContext` | `employeeController.getMe` | `users/{uid}` |
| GET | `/api/employee/jobs` | `src/routes/employee.routes.js` under `/api/employee` | `auth`, `requireRole(employee)`, `employeeContext` | `employeeController.getMyJobs` | `jobs` |
| GET | `/api/employee/jobs/:jobId` | `src/routes/employee.routes.js` under `/api/employee` | `auth`, `requireRole(employee)`, `employeeContext` | `employeeController.getJobById` | `jobs/{jobId}` |
| PATCH | `/api/employee/jobs/:jobId/status` | `src/routes/employee.routes.js` under `/api/employee` | `auth`, `requireRole(employee)`, `employeeContext` | `employeeController.patchJobStatus` | `jobs`, `employeeLocks` |
| POST | `/api/employee/jobs/:jobId/notes` | `src/routes/employee.routes.js` under `/api/employee` | `auth`, `requireRole(employee)`, `employeeContext` | `employeeController.postJobNote` | `jobs/{jobId}` |
| GET | `/api/client/me` | `src/routes/client.routes.js` under `/api/client` | `auth`, `requireRole(client)` | `clientController.getMe` | `users/{uid}` |
| GET | `/api/client/dashboard` | `src/routes/client.routes.js` under `/api/client` | `auth`, `requireRole(client)` | `clientController.getDashboard` | `jobs` |
| GET | `/api/client/jobs` | `src/routes/client.routes.js` under `/api/client` | `auth`, `requireRole(client)` | `clientController.getMyJobs` | `jobs` |
| POST | `/api/client/jobs` | `src/routes/client.routes.js` under `/api/client` | `auth`, `requireRole(client)` | `clientController.createJob` | `jobs` |
| GET | `/api/client/jobs/:jobId` | `src/routes/client.routes.js` under `/api/client` | `auth`, `requireRole(client)` | `clientController.getJobById` | `jobs/{jobId}` |
| PATCH | `/api/client/jobs/:jobId/cancel` | `src/routes/client.routes.js` under `/api/client` | `auth`, `requireRole(client)` | `clientController.cancelJob` | `jobs/{jobId}` |

## Postman Checklist (12+)
Header for protected endpoints: `Authorization: Bearer <ID_TOKEN>`

### Positive (200/201)
1) GET `/api/health` (no token) -> 200 `{ ok:true, data:{...} }`
2) POST `/api/admin/bootstrap-boss` (token: first user) -> 200 `{ ok:true, data:{ uid, role:"boss", ... } }` OR 403 if already bootstrapped
3) GET `/api/boss/me` (token: boss) -> 200 `{ ok:true, data:{ uid, role, email, profile } }`
4) POST `/api/boss/employees` (token: boss) body `{ "email":"e1@demo.com", "password":"TempPass123!", "name":"Employee 1" }` -> 201 `{ ok:true, data:{ uid, email, role:"employee" } }`
5) POST `/api/boss/clients` (token: boss) body `{ "email":"c1@demo.com", "password":"TempPass123!", "name":"Client 1" }` -> 201 `{ ok:true, data:{ uid, email, role:"client" } }`
6) POST `/api/client/jobs` (token: client) body `{ "description":"Breaker keeps tripping", "address":"123 Main St", "priority":"high" }` -> 201 `{ ok:true, data:{ id, status:"open", ... } }`
7) PATCH `/api/boss/jobs/:jobId/assign` (token: boss) body `{ "employeeId":"<employeeUid>" }` -> 200 `{ ok:true, data:{ status:"assigned", employeeId } }`
8) PATCH `/api/employee/jobs/:jobId/status` (token: employee) body `{ "status":"in_progress" }` -> 200 `{ ok:true, data:{ status:"in_progress" } }`

### Negative (400/401/403/404/409)
9) GET `/api/client/me` (no token) -> 401 `{ ok:false, error:{ code:"UNAUTHENTICATED" } }`
10) GET `/api/boss/me` (token: client) -> 403 `{ ok:false, error:{ code:"FORBIDDEN" } }`
11) POST `/api/client/jobs` (token: client) body `{}` -> 400 `{ ok:false, error:{ code:"INVALID_INPUT" } }`
12) PATCH `/api/client/jobs/:jobId/cancel` (token: client) on a non-open job -> 400 `{ ok:false, error:{ code:"INVALID_TRANSITION" } }`
13) PATCH `/api/employee/jobs/:jobId/status` (token: employee) body `{ "status":"done" }` while current is `assigned` -> 400 `{ ok:false, error:{ code:"INVALID_TRANSITION" } }`
14) PATCH `/api/boss/jobs/:jobId/assign` (token: boss) body `{ "employeeId":"<clientUid>" }` -> 400 `{ ok:false, error:{ code:"INVALID_EMPLOYEE" } }`
15) PATCH `/api/boss/jobs/:jobId/assign` (token: boss) assign to locked employee -> 409 `{ ok:false, error:{ code:"EMPLOYEE_LOCKED" } }`

## Firestore Index Notes (recommended)
- `jobs`: `clientId` + `createdAt desc` (client list)
- `jobs`: `employeeId` + `status` + `createdAt desc` (employee active list)
- `users`: `role` + `createdAt desc` (boss lists employees/clients)
Note: services include safe fallbacks when an index is missing (reduced performance).

## Firestore Data Model (minimum contract)
- `users/{uid}`: `role`, `email`, `name?`, `status`, `createdAt`, `updatedAt`
- `jobs/{jobId}`: `clientId`, `employeeId?`, `status`, `description`, `address`, `priority?`, `photos?`, `createdAt`, `updatedAt`, `assignedAt?`, `startedAt?`, `completedAt?`, `cancelledAt?`, `notes?`
- `employeeLocks/{employeeId}`: `activeJobId`, `updatedAt`

## Local Smoke Test (executed)
- Started server and checked:
  - `GET /api/health` -> 200
  - `GET /api/client/me` (no token) -> 401
  - `GET /api/employee/me` (no token) -> 401

## Source Code (final)

### `src/index.js`

```js
'use strict';

/* =========================
   1) Load environment variables FIRST
========================= */
const dotenv = require('dotenv');
const envResult = dotenv.config({ quiet: true });

if (envResult.error) {
  console.warn('[env] Unable to load .env file:', envResult.error.message);
}

/* =========================
   2) Initialize Firebase Admin (AFTER dotenv)
========================= */
require('./firebase');

/* =========================
   3) Imports
========================= */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { rateLimit } = require('express-rate-limit');

/* =========================
   4) Validate PORT
========================= */
if (!process.env.PORT) {
  console.error('[startup] Missing required environment variable: PORT');
  process.exit(1);
}

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0) {
  console.error(`[startup] Invalid PORT value "${process.env.PORT}"`);
  process.exit(1);
}

/* =========================
   5) Initialize Express
========================= */
const app = express();
app.disable('x-powered-by');

/* =========================
   6) Global middlewares
========================= */
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
);

/* =========================
   7) Safe router loader
========================= */
function asRouter(moduleExport, label) {
  if (typeof moduleExport === 'function') return moduleExport;
  if (moduleExport && typeof moduleExport.router === 'function') return moduleExport.router;
  if (moduleExport && typeof moduleExport.default === 'function') return moduleExport.default;

  console.warn(
    `[routes] "${label}" does not export an Express router; mounting empty placeholder.`,
  );
  return express.Router();
}

/* =========================
   8) Security middlewares
========================= */
const auth = require('./middleware/auth');
const requireRole = require('./middleware/requireRole');
const employeeAccess = require('./middleware/employee.middleware');

/* =========================
   9) Routes
========================= */
const healthRoutes = asRouter(require('./routes/health.routes'), 'health.routes.js');
const adminBootstrapRoutes = asRouter(
  require('./routes/admin.bootstrap.routes'),
  'admin.bootstrap.routes.js',
);
const bossRoutes = asRouter(require('./routes/boss.routes'), 'boss.routes.js');
const employeeRoutes = asRouter(require('./routes/employee.routes'), 'employee.routes.js');
const clientRoutes = asRouter(require('./routes/client.routes'), 'client.routes.js');

/* =========================
   10) Route mounting (ORDER IS CRITICAL)
========================= */

// Public / Health
app.use('/api', healthRoutes);

// Bootstrap (AUTH ONLY, sin roles)
// Aqui viven:
// - POST /api/admin/bootstrap-boss
// - POST /api/admin/assign-role
app.use('/api', adminBootstrapRoutes);

// Boss
app.use('/api/boss', auth, requireRole('boss'), bossRoutes);

// Employee
app.use('/api/employee', employeeAccess, employeeRoutes);

// Client
app.use('/api/client', auth, requireRole('client'), clientRoutes);

/* =========================
   11) Root endpoint
========================= */
app.get('/', (req, res) => {
  res.status(200).json({
    ok: true,
    data: {
      service: 'Straight Wire Electric - CRM Backend',
      status: 'active',
    },
  });
});

/* =========================
   12) Error handling
========================= */
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found.',
    },
  });
});

app.use((err, req, res, next) => {
  console.error('[error] Unhandled error:', err);
  const status = err && typeof err.status === 'number' ? err.status : 500;
  const code = err && typeof err.code === 'string' ? err.code : 'INTERNAL_ERROR';

  // Avoid leaking internal details for 5xx errors.
  const message =
    status >= 500 ? 'Internal Server Error' : err.message || 'Request failed.';

  const body = {
    ok: false,
    error: { code, message },
  };

  if (status < 500 && err && err.details !== undefined) {
    body.error.details = err.details;
  }

  res.status(status).json(body);
});

/* =========================
   13) Start server
========================= */
app.listen(port, () => {
  console.log(`[startup] API server listening on port ${port}`);
});
```

### `src/firebase.js`

```js
'use strict';

// Centralized Firebase Admin SDK bootstrap.
// - Uses Application Default Credentials (ADC)
// - Prevents duplicate initialization across imports
// - Exports ready-to-use admin, db (Firestore) and auth instances

const fs = require('fs');
const path = require('path');

const dotenv = require('dotenv');
const admin = require('firebase-admin');

// Load environment variables if a .env is present.
// Quiet avoids noisy logs on every import; it does not override existing env vars by default.
dotenv.config({ quiet: true });

function resolveCredentialsPath(credentialsPath) {
  if (!credentialsPath) return null;
  return path.isAbsolute(credentialsPath)
    ? credentialsPath
    : path.resolve(process.cwd(), credentialsPath);
}

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) return admin.app();

  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const resolvedCredentialsPath = resolveCredentialsPath(credentialsEnv);

  if (resolvedCredentialsPath && !fs.existsSync(resolvedCredentialsPath)) {
    console.error('[firebase] GOOGLE_APPLICATION_CREDENTIALS points to a missing file.');
    console.error(`[firebase] Provided: ${credentialsEnv}`);
    console.error(`[firebase] Resolved: ${resolvedCredentialsPath}`);
    console.error('[firebase] Create the service account JSON file or update GOOGLE_APPLICATION_CREDENTIALS.');
    throw new Error('Firebase Admin SDK initialization failed: missing credentials file.');
  }

  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    return admin.app();
  } catch (err) {
    console.error('[firebase] Failed to initialize Firebase Admin SDK using Application Default Credentials.');
    console.error(
      '[firebase] Provide credentials via GOOGLE_APPLICATION_CREDENTIALS or configure ADC (e.g., gcloud auth application-default login).',
    );
    console.error('[firebase] Original error:', err);
    throw err;
  }
}

initializeFirebaseAdmin();

const db = admin.firestore();
const auth = admin.auth();

module.exports = {
  admin,
  db,
  auth,
};
```

### `src/middleware/auth.js`

```js
'use strict';

// Firebase Authentication middleware (backend authority).
// - Reads: Authorization: Bearer <firebase_id_token>
// - Verifies the token using Firebase Admin SDK (server-side)
// - Attaches a normalized user object to req.user for downstream handlers

const { auth } = require('../firebase');

function sendJsonError(res, status, code, message) {
  return res.status(status).json({
    ok: false,
    error: {
      code,
      message,
    },
  });
}

function extractBearerToken(req) {
  const headerValue = req.get('Authorization') || req.get('authorization');
  if (!headerValue) return null;

  const prefix = 'Bearer ';
  if (!headerValue.startsWith(prefix)) return null;

  const token = headerValue.slice(prefix.length).trim();
  if (!token) return null;

  return token;
}

function isInvalidTokenError(err) {
  // Firebase Admin errors for verifyIdToken typically have codes like:
  // - auth/id-token-expired
  // - auth/id-token-revoked
  // - auth/invalid-id-token
  // - auth/argument-error
  const code = err && err.code;
  if (typeof code !== 'string') return false;

  return (
    code === 'auth/id-token-expired' ||
    code === 'auth/id-token-revoked' ||
    code === 'auth/invalid-id-token' ||
    code === 'auth/argument-error'
  );
}

async function authMiddleware(req, res, next) {
  // 1) Read and validate Authorization header format.
  const token = extractBearerToken(req);
  if (!token) {
    return sendJsonError(res, 401, 'UNAUTHENTICATED', 'Missing or invalid Authorization header.');
  }

  // 2) Verify the ID token using Firebase Admin SDK (server-side).
  //    Do NOT trust client-sent user data; the decoded token is the source of truth.
  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(token);
  } catch (err) {
    // 3) Token is invalid/expired/revoked -> 403 (authenticated header provided, but not authorized).
    if (isInvalidTokenError(err)) {
      console.error('[auth] Token verification failed:', err.code);
      return sendJsonError(res, 403, 'INVALID_TOKEN', 'Invalid or expired token.');
    }

    // 4) Unexpected verification failure (server misconfig, SDK issues, etc.)
    console.error('[auth] Unexpected error while verifying token:', err);
    return sendJsonError(res, 500, 'AUTH_INTERNAL_ERROR', 'Authentication service error.');
  }

  // 5) Attach a normalized user object for downstream middlewares/routes.
  //    "role" is optional and only read if it exists as a custom claim.
  req.user = {
    uid: decodedToken.uid,
    email: decodedToken.email || null,
    role: typeof decodedToken.role === 'string' ? decodedToken.role : null,
    claims: decodedToken,
  };

  return next();
}

module.exports = authMiddleware;
```

### `src/middleware/requireRole.js`

```js
'use strict';

// Role-based authorization middleware (factory).
// Intended usage (after auth middleware):
//   app.get('/api/boss', auth, requireRole('boss'), handler)
//   app.get('/api/staff', auth, requireRole(['boss', 'employee']), handler)
//
// This middleware does NOT talk to Firebase. It only relies on req.user populated by auth middleware.

function sendJsonError(res, status, code, message) {
  return res.status(status).json({
    ok: false,
    error: {
      code,
      message,
    },
  });
}

function normalizeAllowedRoles(input) {
  const roles = Array.isArray(input) ? input : [input];

  const normalized = roles
    .map((role) => (typeof role === 'string' ? role.trim() : ''))
    .filter(Boolean);

  const unique = Array.from(new Set(normalized));

  if (unique.length === 0) {
    throw new TypeError(
      'requireRole(role) expects a non-empty role string or a non-empty array of role strings.',
    );
  }

  return unique;
}

function requireRole(allowed) {
  const allowedRoles = normalizeAllowedRoles(allowed);
  const allowedSet = new Set(allowedRoles);

  return function requireRoleMiddleware(req, res, next) {
    // 1) Must run after auth middleware (req.user must exist).
    if (!req.user) {
      console.warn(`[role] Access denied (unauthenticated). method=${req.method} path=${req.originalUrl || req.url}`);
      return sendJsonError(res, 401, 'UNAUTHENTICATED', 'Authentication required.');
    }

    // 2) Role must exist on req.user (typically from a custom claim).
    const userRole = req.user.role;
    if (typeof userRole !== 'string' || userRole.trim() === '') {
      console.warn(`[role] Access denied (missing role). uid=${req.user.uid || 'unknown'} method=${req.method} path=${req.originalUrl || req.url}`);
      return sendJsonError(res, 403, 'ROLE_MISSING', 'User role is required to access this resource.');
    }

    // 3) Role must be one of the allowed roles.
    if (!allowedSet.has(userRole)) {
      console.warn(
        `[role] Access denied (insufficient role). uid=${req.user.uid || 'unknown'} role=${userRole} required=${allowedRoles.join(
          ',',
        )}`,
      );
      return sendJsonError(res, 403, 'FORBIDDEN', 'Insufficient permissions.');
    }

    return next();
  };
}

module.exports = requireRole;
```

### `src/middleware/employee.middleware.js`

```js
'use strict';

// Employee access guard.
// - Ensures the request is authenticated (auth middleware must run before this).
// - Ensures the user has role "employee".
// - Injects req.employeeId for downstream handlers.

const auth = require('./auth');
const requireRole = require('./requireRole');

function sendError(res, status, code, message) {
  return res.status(status).json({
    ok: false,
    error: { code, message },
  });
}

function ensureEmployeeContext(req, res, next) {
  if (!req.user || !req.user.uid) {
    return sendError(res, 401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  const role = typeof req.user.role === 'string' ? req.user.role : null;
  if (role !== 'employee') {
    return sendError(res, 403, 'FORBIDDEN', 'Employee role required.');
  }

  req.employeeId = req.user.uid;
  return next();
}

// Export as an array so it can be mounted directly.
module.exports = [auth, requireRole('employee'), ensureEmployeeContext];
```

### `src/routes/health.routes.js`

```js
'use strict';

// Health check routes (public).
// Mounted under `/api` from `src/index.js`.

const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => {
  return res.status(200).json({
    ok: true,
    data: {
      status: 'ok',
      service: 'Straight Wire Electric - CRM Backend',
      timestamp: new Date().toISOString(),
    },
  });
});

module.exports = router;
```

### `src/routes/admin.bootstrap.routes.js`

```js
'use strict';

// Admin/bootstrap routes.
// Mounted under `/api` from `src/index.js`.
//
// Endpoints:
// - POST /api/admin/bootstrap-boss  (one-time; only if no boss exists)
// - POST /api/admin/assign-role     (boss only)

const express = require('express');

const authMiddleware = require('../middleware/auth');
const { db } = require('../firebase');
const { assignUserRole } = require('../services/roles.service');
const { ok, fail } = require('../utils/response');

const router = express.Router();

const USERS_COLLECTION = 'users';
const ALLOWED_ROLES = new Set(['boss', 'employee', 'client']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

async function bossExistsInFirestore() {
  const snap = await db
    .collection(USERS_COLLECTION)
    .where('role', '==', 'boss')
    .limit(1)
    .get();

  return !snap.empty;
}

function handleError(res, err, fallbackCode) {
  const status = err && typeof err.status === 'number' ? err.status : 500;
  const code = err && typeof err.code === 'string' ? err.code : fallbackCode || 'INTERNAL_ERROR';
  const message = status >= 500 ? 'Internal Server Error' : err.message || 'Request failed.';

  if (status >= 500) console.error('[admin]', err);
  return fail(res, status, code, message);
}

// POST /api/admin/bootstrap-boss
router.post('/admin/bootstrap-boss', authMiddleware, async (req, res) => {
  const uid = req.user && req.user.uid;
  if (!uid) return fail(res, 401, 'UNAUTHENTICATED', 'Authentication required.');

  try {
    if (await bossExistsInFirestore()) {
      console.warn(`[admin] bootstrap-boss blocked (boss already exists). uid=${uid}`);
      return fail(res, 403, 'BOOTSTRAP_DISABLED', 'Boss already exists. Bootstrap is disabled.');
    }
  } catch (err) {
    console.error('[admin] Failed to check boss existence:', err);
    return fail(res, 500, 'BOOTSTRAP_CHECK_FAILED', 'Unable to validate bootstrap preconditions.');
  }

  try {
    const result = await assignUserRole(uid, 'boss');
    return ok(res, {
      ...result,
      message: 'Boss role assigned. Refresh your ID token to receive updated claims.',
    });
  } catch (err) {
    return handleError(res, err, 'BOOTSTRAP_FAILED');
  }
});

// POST /api/admin/assign-role
// Body: { uid, role }
router.post('/admin/assign-role', authMiddleware, async (req, res) => {
  const requesterRole = req.user && req.user.role;
  if (requesterRole !== 'boss') {
    console.warn('[admin] assign-role blocked (requester not boss).');
    return fail(res, 403, 'FORBIDDEN', 'Only boss can assign roles.');
  }

  const targetUid = req.body && req.body.uid;
  const role = req.body && req.body.role;

  if (!isNonEmptyString(targetUid) || !isNonEmptyString(role)) {
    return fail(res, 400, 'INVALID_INPUT', 'uid and role are required.');
  }

  const normalizedRole = role.trim();
  if (!ALLOWED_ROLES.has(normalizedRole)) {
    return fail(res, 400, 'INVALID_ROLE', 'role must be boss | employee | client.');
  }

  try {
    const result = await assignUserRole(targetUid, normalizedRole);
    return ok(res, {
      ...result,
      message: 'Role assigned successfully. User must refresh ID token.',
    });
  } catch (err) {
    return handleError(res, err, 'ASSIGN_ROLE_FAILED');
  }
});

module.exports = router;
```

### `src/routes/boss.routes.js`

```js
'use strict';

// Boss routes (protected).
// Mounted under `/api/boss` from `src/index.js` (auth + requireRole('boss') are applied there).
//
// Endpoints:
// - GET    /api/boss/me
// - GET    /api/boss/employees
// - POST   /api/boss/employees
// - GET    /api/boss/clients
// - POST   /api/boss/clients
// - GET    /api/boss/jobs
// - PATCH  /api/boss/jobs/:jobId/assign
// - PATCH  /api/boss/jobs/:jobId/unassign
// - POST   /api/boss/assign-role  (compat; prefer /api/admin/assign-role)

const express = require('express');

const {
  getMe,
  assignRole,
  listEmployees,
  createEmployee,
  listClients,
  createClient,
  listJobs,
  assignJob,
  unassignJob,
} = require('../controllers/boss.controller');

const router = express.Router();

router.get('/me', getMe);

router.get('/employees', listEmployees);
router.post('/employees', createEmployee);

router.get('/clients', listClients);
router.post('/clients', createClient);

router.get('/jobs', listJobs);
router.patch('/jobs/:jobId/assign', assignJob);
router.patch('/jobs/:jobId/unassign', unassignJob);

router.post('/assign-role', assignRole);

module.exports = router;
```

### `src/routes/employee.routes.js`

```js
'use strict';

// Employee routes (protected).
// Mounted under /api/employee from src/index.js:
// - GET    /api/employee/me
// - GET    /api/employee/jobs
// - PATCH  /api/employee/jobs/:jobId/status

const express = require('express');

const {
  getMe,
  getMyJobs,
  patchJobStatus,
  getJobById,
  postJobNote,
} = require('../controllers/employee.controller');

const router = express.Router();

router.get('/me', getMe);
router.get('/jobs', getMyJobs);
router.get('/jobs/:jobId', getJobById);
router.patch('/jobs/:jobId/status', patchJobStatus);
router.post('/jobs/:jobId/notes', postJobNote);

module.exports = router;
```

### `src/routes/client.routes.js`

```js
'use strict';

// Client routes (protected).
// Mounted under `/api/client` from `src/index.js` (auth + requireRole('client') are applied there).
//
// Endpoints:
// - GET    /api/client/me
// - GET    /api/client/dashboard
// - GET    /api/client/jobs
// - POST   /api/client/jobs
// - GET    /api/client/jobs/:jobId
// - PATCH  /api/client/jobs/:jobId/cancel

const express = require('express');

const {
  getMe,
  getMyJobs,
  createJob,
  getJobById,
  cancelJob,
  getDashboard,
} = require('../controllers/client.controller');

const router = express.Router();

router.get('/me', getMe);
router.get('/dashboard', getDashboard);

router.get('/jobs', getMyJobs);
router.post('/jobs', createJob);
router.get('/jobs/:jobId', getJobById);
router.patch('/jobs/:jobId/cancel', cancelJob);

module.exports = router;
```

### `src/controllers/boss.controller.js`

```js
'use strict';

// Boss controllers (thin layer over services).
// All routes are mounted behind: auth + requireRole('boss') in `src/index.js`.

const { z } = require('zod');

const { auth } = require('../firebase');
const { assignUserRole } = require('../services/roles.service');
const {
  getUserProfile,
  upsertUserProfile,
  listUsersByRole,
} = require('../services/users.service');
const {
  STATUS,
  listJobsForBoss,
  assignJobToEmployee,
  unassignJob,
} = require('../services/jobs.service');
const { ok, fail } = require('../utils/response');

function handleServiceError(res, err) {
  if (err && typeof err.status === 'number') {
    return fail(
      res,
      err.status,
      err.code || 'SERVICE_ERROR',
      err.message || 'Service error.',
      err.details,
    );
  }

  console.error('[boss] Unexpected error:', err);
  return fail(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
}

function resolveBossId(req) {
  return req.user && req.user.uid ? req.user.uid : null;
}

function normalizeLimit(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 200);
}

const assignRoleSchema = z.object({
  uid: z.string().trim().min(1),
  role: z.enum(['boss', 'employee', 'client']),
});

const createUserSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
  name: z.string().trim().min(1).optional(),
});

function mapFirebaseCreateUserError(res, err) {
  const code = err && err.code;

  if (code === 'auth/email-already-exists') {
    return fail(res, 409, 'EMAIL_EXISTS', 'A user with this email already exists.');
  }
  if (code === 'auth/invalid-email') {
    return fail(res, 400, 'INVALID_EMAIL', 'Invalid email address.');
  }
  if (code === 'auth/invalid-password') {
    return fail(res, 400, 'INVALID_PASSWORD', 'Invalid password.');
  }
  if (code === 'auth/weak-password') {
    return fail(res, 400, 'WEAK_PASSWORD', 'Password is too weak.');
  }

  console.error('[boss] Failed to create Firebase Auth user:', err);
  return fail(res, 500, 'AUTH_CREATE_FAILED', 'Unable to create user.');
}

async function getMe(req, res) {
  const bossId = resolveBossId(req);
  if (!bossId) return fail(res, 401, 'UNAUTHENTICATED', 'Authentication required.');

  try {
    const profile = await getUserProfile(bossId, {
      notFoundCode: 'BOSS_NOT_FOUND',
      notFoundMessage: 'Boss profile not found.',
    });

    return ok(res, {
      uid: bossId,
      role: req.user ? req.user.role : null,
      email: req.user ? req.user.email : null,
      status: profile.status || null,
      claims: req.user ? req.user.claims : null,
      profile,
    });
  } catch (err) {
    return handleServiceError(res, err);
  }
}

// POST /api/boss/assign-role (compat endpoint; prefer /api/admin/assign-role)
async function assignRole(req, res) {
  let input;
  try {
    input = assignRoleSchema.parse(req.body || {});
  } catch (err) {
    return fail(res, 400, 'INVALID_INPUT', 'uid and role are required.');
  }

  try {
    const result = await assignUserRole(input.uid, input.role);
    return ok(res, {
      ...result,
      message: 'Role assigned successfully. User must refresh ID token.',
    });
  } catch (err) {
    return handleServiceError(res, err);
  }
}

async function listEmployees(req, res) {
  try {
    const limit = normalizeLimit(req.query && req.query.limit, 100);
    const employees = await listUsersByRole('employee', { limit });
    return ok(res, employees);
  } catch (err) {
    return handleServiceError(res, err);
  }
}

async function listClients(req, res) {
  try {
    const limit = normalizeLimit(req.query && req.query.limit, 100);
    const clients = await listUsersByRole('client', { limit });
    return ok(res, clients);
  } catch (err) {
    return handleServiceError(res, err);
  }
}

async function createEmployee(req, res) {
  let input;
  try {
    input = createUserSchema.parse(req.body || {});
  } catch (err) {
    return fail(res, 400, 'INVALID_INPUT', 'email and password are required.');
  }

  let userRecord;
  try {
    userRecord = await auth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.name,
    });
  } catch (err) {
    return mapFirebaseCreateUserError(res, err);
  }

  try {
    const roleResult = await assignUserRole(userRecord.uid, 'employee');

    if (input.name) {
      await upsertUserProfile(userRecord.uid, { name: input.name });
    }

    return ok(
      res,
      {
        uid: roleResult.uid,
        email: roleResult.email,
        role: roleResult.role,
      },
      201,
    );
  } catch (err) {
    // Best-effort cleanup: avoid leaving an orphaned auth user without proper role setup.
    try {
      await auth.deleteUser(userRecord.uid);
    } catch (cleanupErr) {
      console.error('[boss] Failed to cleanup user after role assignment failure:', cleanupErr);
    }

    return handleServiceError(res, err);
  }
}

async function createClient(req, res) {
  let input;
  try {
    input = createUserSchema.parse(req.body || {});
  } catch (err) {
    return fail(res, 400, 'INVALID_INPUT', 'email and password are required.');
  }

  let userRecord;
  try {
    userRecord = await auth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.name,
    });
  } catch (err) {
    return mapFirebaseCreateUserError(res, err);
  }

  try {
    const roleResult = await assignUserRole(userRecord.uid, 'client');

    if (input.name) {
      await upsertUserProfile(userRecord.uid, { name: input.name });
    }

    return ok(
      res,
      {
        uid: roleResult.uid,
        email: roleResult.email,
        role: roleResult.role,
      },
      201,
    );
  } catch (err) {
    try {
      await auth.deleteUser(userRecord.uid);
    } catch (cleanupErr) {
      console.error('[boss] Failed to cleanup user after role assignment failure:', cleanupErr);
    }

    return handleServiceError(res, err);
  }
}

async function listJobs(req, res) {
  const status = req.query && typeof req.query.status === 'string' ? req.query.status.trim() : null;
  const employeeId =
    req.query && typeof req.query.employeeId === 'string' ? req.query.employeeId.trim() : null;
  const clientId =
    req.query && typeof req.query.clientId === 'string' ? req.query.clientId.trim() : null;
  const limit = normalizeLimit(req.query && req.query.limit, 100);

  if (status && !Object.values(STATUS).includes(status)) {
    return fail(res, 400, 'INVALID_STATUS', `status must be one of: ${Object.values(STATUS).join(' | ')}`);
  }

  try {
    const jobs = await listJobsForBoss({ status, employeeId, clientId, limit });
    return ok(res, jobs);
  } catch (err) {
    return handleServiceError(res, err);
  }
}

async function assignJob(req, res) {
  const jobId = req.params && req.params.jobId;
  if (!jobId) return fail(res, 400, 'INVALID_INPUT', 'jobId is required.');

  const employeeId = req.body && req.body.employeeId;
  if (typeof employeeId !== 'string' || employeeId.trim() === '') {
    return fail(res, 400, 'INVALID_INPUT', 'employeeId is required.');
  }

  const normalizedEmployeeId = employeeId.trim();

  try {
    const employeeProfile = await getUserProfile(normalizedEmployeeId, {
      notFoundCode: 'EMPLOYEE_NOT_FOUND',
      notFoundMessage: 'Employee not found.',
    });

    if (employeeProfile.role !== 'employee') {
      return fail(res, 400, 'INVALID_EMPLOYEE', 'Target user is not an employee.');
    }

    if (employeeProfile.status && employeeProfile.status !== 'active') {
      return fail(res, 409, 'EMPLOYEE_INACTIVE', 'Employee is not active.');
    }

    const job = await assignJobToEmployee(jobId, normalizedEmployeeId);
    return ok(res, job);
  } catch (err) {
    return handleServiceError(res, err);
  }
}

async function unassignJobHandler(req, res) {
  const jobId = req.params && req.params.jobId;
  if (!jobId) return fail(res, 400, 'INVALID_INPUT', 'jobId is required.');

  try {
    const job = await unassignJob(jobId);
    return ok(res, job);
  } catch (err) {
    return handleServiceError(res, err);
  }
}

module.exports = {
  getMe,
  assignRole,
  listEmployees,
  createEmployee,
  listClients,
  createClient,
  listJobs,
  assignJob,
  unassignJob: unassignJobHandler,
};
```

### `src/controllers/employee.controller.js`

```js
'use strict';

// Employee controllers (thin layer over services).
// Handles HTTP concerns (status codes, response shape) and delegates data access to services.

const {
  listEmployeeActiveJobs,
  getJobForEmployee,
  addEmployeeNoteToJob,
  transitionJobStatusForEmployee,
} = require('../services/jobs.service');
const { getUserProfile } = require('../services/users.service');
const { ok, fail } = require('../utils/response');

function handleServiceError(res, err) {
  if (err && typeof err.status === 'number') {
    return fail(res, err.status, err.code || 'SERVICE_ERROR', err.message || 'Service error.', err.details);
  }

  console.error('[employee] Unexpected error:', err);
  return fail(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
}

function resolveEmployeeId(req) {
  if (req.employeeId) return req.employeeId;
  if (req.user && req.user.uid) return req.user.uid;
  return null;
}

async function getMe(req, res) {
  const employeeId = resolveEmployeeId(req);
  if (!employeeId) {
    return fail(res, 401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  try {
    const profile = await getUserProfile(employeeId, {
      notFoundCode: 'EMPLOYEE_NOT_FOUND',
      notFoundMessage: 'Employee profile not found.',
    });

    return ok(res, {
      uid: employeeId,
      role: req.user ? req.user.role : null,
      email: req.user ? req.user.email : null,
      status: profile.status || null,
      claims: req.user ? req.user.claims : null,
      profile,
    });
  } catch (err) {
    return handleServiceError(res, err);
  }
}

async function getMyJobs(req, res) {
  const employeeId = resolveEmployeeId(req);
  if (!employeeId) {
    return fail(res, 401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  try {
    const jobs = await listEmployeeActiveJobs(employeeId);
    return ok(res, jobs);
  } catch (err) {
    return handleServiceError(res, err);
  }
}

async function patchJobStatus(req, res) {
  const employeeId = resolveEmployeeId(req);
  if (!employeeId) {
    return fail(res, 401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  const jobId = req.params && req.params.jobId;
  if (!jobId) {
    return fail(res, 400, 'INVALID_INPUT', 'Job ID is required.');
  }

  const nextStatus = req.body && req.body.status;

  try {
    const updatedJob = await transitionJobStatusForEmployee(employeeId, jobId, nextStatus);
    return ok(res, updatedJob);
  } catch (err) {
    return handleServiceError(res, err);
  }
}

async function getJobById(req, res) {
  const employeeId = resolveEmployeeId(req);
  if (!employeeId) {
    return fail(res, 401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  const jobId = req.params && req.params.jobId;
  if (!jobId) {
    return fail(res, 400, 'INVALID_INPUT', 'Job ID is required.');
  }

  try {
    const job = await getJobForEmployee(employeeId, jobId);
    return ok(res, job);
  } catch (err) {
    return handleServiceError(res, err);
  }
}

async function postJobNote(req, res) {
  const employeeId = resolveEmployeeId(req);
  if (!employeeId) {
    return fail(res, 401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  const jobId = req.params && req.params.jobId;
  if (!jobId) {
    return fail(res, 400, 'INVALID_INPUT', 'Job ID is required.');
  }

  const text = req.body && req.body.text;
  if (typeof text !== 'string' || text.trim() === '') {
    return fail(res, 400, 'INVALID_INPUT', 'text must be a non-empty string.');
  }

  try {
    const job = await addEmployeeNoteToJob(employeeId, jobId, text);
    return ok(res, job);
  } catch (err) {
    return handleServiceError(res, err);
  }
}

module.exports = {
  getMe,
  getMyJobs,
  patchJobStatus,
  getJobById,
  postJobNote,
};
```

### `src/controllers/client.controller.js`

```js
'use strict';

// Client controllers.

const { z } = require('zod');

const {
  listClientJobs,
  createJobForClient,
  getJobForClient,
  cancelJobForClient,
  STATUS,
} = require('../services/jobs.service');
const { getUserProfile } = require('../services/users.service');
const { ok, fail } = require('../utils/response');

function handleServiceError(res, err) {
  if (err && typeof err.status === 'number') {
    return fail(res, err.status, err.code || 'SERVICE_ERROR', err.message || 'Service error.', err.details);
  }

  console.error('[client] Unexpected error:', err);
  return fail(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
}

function resolveClientId(req) {
  if (req.user && req.user.uid) return req.user.uid;
  return null;
}

const createJobSchema = z.object({
  description: z.string().trim().min(1),
  address: z.string().trim().min(1),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  photos: z.array(z.string().trim().min(1)).optional(),
});

async function getMe(req, res) {
  const clientId = resolveClientId(req);
  if (!clientId) return fail(res, 401, 'UNAUTHENTICATED', 'Authentication required.');

  try {
    const profile = await getUserProfile(clientId, {
      notFoundCode: 'CLIENT_NOT_FOUND',
      notFoundMessage: 'Client profile not found.',
    });

    return ok(res, {
      uid: clientId,
      role: req.user ? req.user.role : null,
      email: req.user ? req.user.email : null,
      status: profile.status || null,
      claims: req.user ? req.user.claims : null,
      profile,
    });
  } catch (err) {
    return handleServiceError(res, err);
  }
}

async function getMyJobs(req, res) {
  const clientId = resolveClientId(req);
  if (!clientId) return fail(res, 401, 'UNAUTHENTICATED', 'Authentication required.');

  try {
    const jobs = await listClientJobs(clientId, { limit: req.query && req.query.limit });
    return ok(res, jobs);
  } catch (err) {
    return handleServiceError(res, err);
  }
}

async function createJob(req, res) {
  const clientId = resolveClientId(req);
  if (!clientId) return fail(res, 401, 'UNAUTHENTICATED', 'Authentication required.');

  let input;
  try {
    input = createJobSchema.parse(req.body || {});
  } catch (err) {
    return fail(res, 400, 'INVALID_INPUT', 'Invalid request body.', err && err.issues ? err.issues : undefined);
  }

  try {
    const job = await createJobForClient(clientId, input);
    return ok(res, job, 201);
  } catch (err) {
    return handleServiceError(res, err);
  }
}

async function getJobById(req, res) {
  const clientId = resolveClientId(req);
  if (!clientId) return fail(res, 401, 'UNAUTHENTICATED', 'Authentication required.');

  const jobId = req.params && req.params.jobId;
  if (!jobId) return fail(res, 400, 'INVALID_INPUT', 'Job ID is required.');

  try {
    const job = await getJobForClient(clientId, jobId);
    return ok(res, job);
  } catch (err) {
    return handleServiceError(res, err);
  }
}

async function cancelJob(req, res) {
  const clientId = resolveClientId(req);
  if (!clientId) return fail(res, 401, 'UNAUTHENTICATED', 'Authentication required.');

  const jobId = req.params && req.params.jobId;
  if (!jobId) return fail(res, 400, 'INVALID_INPUT', 'Job ID is required.');

  try {
    const job = await cancelJobForClient(clientId, jobId);
    return ok(res, job);
  } catch (err) {
    return handleServiceError(res, err);
  }
}

async function getDashboard(req, res) {
  const clientId = resolveClientId(req);
  if (!clientId) return fail(res, 401, 'UNAUTHENTICATED', 'Authentication required.');

  try {
    const jobs = await listClientJobs(clientId, { limit: 200 });

    const activeStatuses = new Set([STATUS.OPEN, STATUS.ASSIGNED, STATUS.IN_PROGRESS]);
    const activeRequests = jobs.filter((j) => activeStatuses.has(j.status)).length;
    const completedRequests = jobs.filter((j) => j.status === STATUS.DONE).length;

    return ok(res, {
      activeRequests,
      completedRequests,
    });
  } catch (err) {
    return handleServiceError(res, err);
  }
}

module.exports = {
  getMe,
  getMyJobs,
  createJob,
  getJobById,
  cancelJob,
  getDashboard,
};
```

### `src/services/jobs.service.js`

```js
'use strict';

// Firestore-backed job operations for the CRM.
//
// Security:
// - Employee operations verify job ownership by employeeId.
// - Client operations verify job ownership by clientId.
// - Boss operations are intended to be mounted behind requireRole('boss').

const { admin, db } = require('../firebase');
const { acquireLock, releaseLock } = require('../locks/employeeLock.service');
const { appError, isFirestoreIndexRequiredError } = require('../utils/errors');

const JOBS_COLLECTION = 'jobs';

const STATUS = {
  OPEN: 'open',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  CANCELLED: 'cancelled',
};

const EMPLOYEE_ACTIVE_STATUSES = [STATUS.ASSIGNED, STATUS.IN_PROGRESS];

const EMPLOYEE_TRANSITIONS = {
  [STATUS.ASSIGNED]: [STATUS.IN_PROGRESS],
  [STATUS.IN_PROGRESS]: [STATUS.DONE],
};

// Policy decision: clients can cancel only while the job is still open.
const CLIENT_CANCELLABLE_STATUSES = [STATUS.OPEN];

function normalizeLimit(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 200);
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const date = value instanceof Date ? value : null;
  return date ? date.getTime() : 0;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw appError(400, 'INVALID_INPUT', `${label} is required.`);
  }
}

function mapDoc(doc) {
  return { id: doc.id, ...doc.data() };
}

/* ============================================================
   EMPLOYEE
============================================================ */

async function listEmployeeActiveJobs(employeeId) {
  requireNonEmptyString(employeeId, 'employeeId');

  try {
    const snap = await db
      .collection(JOBS_COLLECTION)
      .where('employeeId', '==', employeeId)
      .where('status', 'in', EMPLOYEE_ACTIVE_STATUSES)
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs.map(mapDoc);
  } catch (err) {
    if (!isFirestoreIndexRequiredError(err)) throw err;

    // Fallback (no composite index): fetch a bounded set and sort/filter in memory.
    const snap = await db
      .collection(JOBS_COLLECTION)
      .where('employeeId', '==', employeeId)
      .limit(200)
      .get();

    return snap.docs
      .map(mapDoc)
      .filter((job) => EMPLOYEE_ACTIVE_STATUSES.includes(job.status))
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  }
}

async function getJobForEmployee(employeeId, jobId) {
  requireNonEmptyString(employeeId, 'employeeId');
  requireNonEmptyString(jobId, 'jobId');

  const snap = await db.collection(JOBS_COLLECTION).doc(jobId).get();
  if (!snap.exists) throw appError(404, 'JOB_NOT_FOUND', 'Job not found.');

  const job = snap.data();
  if (!job || job.employeeId !== employeeId) {
    throw appError(403, 'FORBIDDEN', 'Job does not belong to the employee.');
  }

  return { id: snap.id, ...job };
}

async function addEmployeeNoteToJob(employeeId, jobId, text) {
  requireNonEmptyString(employeeId, 'employeeId');
  requireNonEmptyString(jobId, 'jobId');
  requireNonEmptyString(text, 'text');

  const trimmedText = text.trim();
  const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) throw appError(404, 'JOB_NOT_FOUND', 'Job not found.');

    const job = snap.data();
    if (!job || job.employeeId !== employeeId) {
      throw appError(403, 'FORBIDDEN', 'Job does not belong to the employee.');
    }

    const note = {
      byUid: employeeId,
      text: trimmedText,
      // Timestamp generated by the backend server process.
      createdAt: admin.firestore.Timestamp.now(),
    };

    tx.update(jobRef, {
      notes: admin.firestore.FieldValue.arrayUnion(note),
      updatedAt: serverTimestamp,
    });
  });

  const fresh = await jobRef.get();
  return mapDoc(fresh);
}

async function transitionJobStatusForEmployee(employeeId, jobId, nextStatus) {
  requireNonEmptyString(employeeId, 'employeeId');
  requireNonEmptyString(jobId, 'jobId');
  requireNonEmptyString(nextStatus, 'status');

  const normalizedNextStatus = nextStatus.trim();
  if (![STATUS.IN_PROGRESS, STATUS.DONE].includes(normalizedNextStatus)) {
    throw appError(400, 'INVALID_STATUS', 'status must be in_progress | done.');
  }

  const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) throw appError(404, 'JOB_NOT_FOUND', 'Job not found.');

    const job = snap.data();
    if (!job || job.employeeId !== employeeId) {
      throw appError(403, 'FORBIDDEN', 'Job does not belong to the employee.');
    }

    const currentStatus = job.status;
    const allowedNext = EMPLOYEE_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(normalizedNextStatus)) {
      throw appError(400, 'INVALID_TRANSITION', 'Status transition not allowed.');
    }

    const update = {
      status: normalizedNextStatus,
      updatedAt: serverTimestamp,
    };

    if (normalizedNextStatus === STATUS.IN_PROGRESS && !job.startedAt) {
      update.startedAt = serverTimestamp;
    }
    if (normalizedNextStatus === STATUS.DONE && !job.completedAt) {
      update.completedAt = serverTimestamp;
    }

    if (normalizedNextStatus === STATUS.IN_PROGRESS) {
      await acquireLock(tx, employeeId, jobId);
    }
    if (normalizedNextStatus === STATUS.DONE) {
      await releaseLock(tx, employeeId, jobId);
    }

    tx.update(jobRef, update);
  });

  const fresh = await jobRef.get();
  return mapDoc(fresh);
}

/* ============================================================
   CLIENT
============================================================ */

async function listClientJobs(clientId, options = {}) {
  requireNonEmptyString(clientId, 'clientId');
  const limit = normalizeLimit(options.limit, 100);

  try {
    const snap = await db
      .collection(JOBS_COLLECTION)
      .where('clientId', '==', clientId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map(mapDoc);
  } catch (err) {
    if (!isFirestoreIndexRequiredError(err)) throw err;

    const snap = await db
      .collection(JOBS_COLLECTION)
      .where('clientId', '==', clientId)
      .limit(200)
      .get();

    return snap.docs
      .map(mapDoc)
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      .slice(0, limit);
  }
}

async function createJobForClient(clientId, input) {
  requireNonEmptyString(clientId, 'clientId');
  if (!input || typeof input !== 'object') {
    throw appError(400, 'INVALID_INPUT', 'Job payload is required.');
  }

  const description = input.description;
  const address = input.address;
  const priority = input.priority;
  const photos = input.photos;

  requireNonEmptyString(description, 'description');
  requireNonEmptyString(address, 'address');

  const jobRef = db.collection(JOBS_COLLECTION).doc();
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  const job = {
    clientId,
    employeeId: null,
    status: STATUS.OPEN,
    description: description.trim(),
    address: address.trim(),
    createdAt: serverTimestamp,
    updatedAt: serverTimestamp,
  };

  if (typeof priority === 'string' && priority.trim() !== '') {
    job.priority = priority.trim();
  }

  if (Array.isArray(photos)) {
    job.photos = photos.filter((p) => typeof p === 'string' && p.trim() !== '').map((p) => p.trim());
  }

  await jobRef.set(job);

  const fresh = await jobRef.get();
  return mapDoc(fresh);
}

async function getJobForClient(clientId, jobId) {
  requireNonEmptyString(clientId, 'clientId');
  requireNonEmptyString(jobId, 'jobId');

  const snap = await db.collection(JOBS_COLLECTION).doc(jobId).get();
  if (!snap.exists) throw appError(404, 'JOB_NOT_FOUND', 'Job not found.');

  const job = snap.data();
  if (!job || job.clientId !== clientId) {
    throw appError(403, 'FORBIDDEN', 'Job does not belong to the client.');
  }

  return { id: snap.id, ...job };
}

async function cancelJobForClient(clientId, jobId) {
  requireNonEmptyString(clientId, 'clientId');
  requireNonEmptyString(jobId, 'jobId');

  const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) throw appError(404, 'JOB_NOT_FOUND', 'Job not found.');

    const job = snap.data();
    if (!job || job.clientId !== clientId) {
      throw appError(403, 'FORBIDDEN', 'Job does not belong to the client.');
    }

    if (!CLIENT_CANCELLABLE_STATUSES.includes(job.status)) {
      throw appError(400, 'INVALID_TRANSITION', 'Job cannot be cancelled in its current status.');
    }

    tx.update(jobRef, {
      status: STATUS.CANCELLED,
      cancelledAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });
  });

  const fresh = await jobRef.get();
  return mapDoc(fresh);
}

/* ============================================================
   BOSS
============================================================ */

async function listJobsForBoss(options = {}) {
  const limit = normalizeLimit(options.limit, 100);
  const status = typeof options.status === 'string' && options.status.trim() ? options.status.trim() : null;
  const employeeId = typeof options.employeeId === 'string' && options.employeeId.trim() ? options.employeeId.trim() : null;
  const clientId = typeof options.clientId === 'string' && options.clientId.trim() ? options.clientId.trim() : null;

  // Choose the most selective base query and filter the rest in memory if needed.
  let baseQuery = db.collection(JOBS_COLLECTION);
  let needsInMemoryFilter = false;

  if (employeeId) {
    baseQuery = baseQuery.where('employeeId', '==', employeeId);
    needsInMemoryFilter = Boolean(status || clientId);
  } else if (clientId) {
    baseQuery = baseQuery.where('clientId', '==', clientId);
    needsInMemoryFilter = Boolean(status);
  } else if (status) {
    baseQuery = baseQuery.where('status', '==', status);
  } else {
    // No filters: can use a simple orderBy on createdAt (single-field index).
    const snap = await baseQuery.orderBy('createdAt', 'desc').limit(limit).get();
    return snap.docs.map(mapDoc);
  }

  // Prefer orderBy(createdAt) if index exists; otherwise fall back.
  try {
    const snap = await baseQuery.orderBy('createdAt', 'desc').limit(limit).get();
    let jobs = snap.docs.map(mapDoc);

    if (needsInMemoryFilter) {
      if (status) jobs = jobs.filter((j) => j.status === status);
      if (clientId) jobs = jobs.filter((j) => j.clientId === clientId);
    }

    return jobs;
  } catch (err) {
    if (!isFirestoreIndexRequiredError(err)) throw err;

    const snap = await baseQuery.limit(200).get();
    let jobs = snap.docs.map(mapDoc);

    if (status) jobs = jobs.filter((j) => j.status === status);
    if (clientId) jobs = jobs.filter((j) => j.clientId === clientId);

    return jobs
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      .slice(0, limit);
  }
}

async function assignJobToEmployee(jobId, employeeId) {
  requireNonEmptyString(jobId, 'jobId');
  requireNonEmptyString(employeeId, 'employeeId');

  const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) throw appError(404, 'JOB_NOT_FOUND', 'Job not found.');

    const job = snap.data();
    if (!job) throw appError(404, 'JOB_NOT_FOUND', 'Job not found.');

    if (job.status !== STATUS.OPEN) {
      throw appError(400, 'INVALID_TRANSITION', 'Only open jobs can be assigned.');
    }

    await acquireLock(tx, employeeId, jobId);

    tx.update(jobRef, {
      employeeId,
      status: STATUS.ASSIGNED,
      assignedAt: job.assignedAt || serverTimestamp,
      updatedAt: serverTimestamp,
    });
  });

  const fresh = await jobRef.get();
  return mapDoc(fresh);
}

async function unassignJob(jobId) {
  requireNonEmptyString(jobId, 'jobId');

  const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) throw appError(404, 'JOB_NOT_FOUND', 'Job not found.');

    const job = snap.data();
    if (!job) throw appError(404, 'JOB_NOT_FOUND', 'Job not found.');

    if (job.status !== STATUS.ASSIGNED) {
      throw appError(400, 'INVALID_TRANSITION', 'Only assigned jobs can be unassigned.');
    }

    if (!job.employeeId) {
      throw appError(400, 'INVALID_STATE', 'Job has no employeeId to unassign.');
    }

    await releaseLock(tx, job.employeeId, jobId);

    tx.update(jobRef, {
      employeeId: null,
      status: STATUS.OPEN,
      unassignedAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });
  });

  const fresh = await jobRef.get();
  return mapDoc(fresh);
}

module.exports = {
  STATUS,

  // Employee
  listEmployeeActiveJobs,
  getJobForEmployee,
  addEmployeeNoteToJob,
  transitionJobStatusForEmployee,

  // Client
  listClientJobs,
  createJobForClient,
  getJobForClient,
  cancelJobForClient,

  // Boss
  listJobsForBoss,
  assignJobToEmployee,
  unassignJob,
};
```

### `src/services/users.service.js`

```js
'use strict';

// Firestore-backed user operations.

const { admin, db } = require('../firebase');
const { appError, isFirestoreIndexRequiredError } = require('../utils/errors');

const USERS_COLLECTION = 'users';

function normalizeLimit(limit, fallback) {
  const parsed = Number(limit);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 200);
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const date = value instanceof Date ? value : null;
  return date ? date.getTime() : 0;
}

async function getUserProfile(uid, options = {}) {
  const notFoundCode = options.notFoundCode || 'USER_NOT_FOUND';
  const notFoundMessage = options.notFoundMessage || 'User profile not found.';

  const doc = await db.collection(USERS_COLLECTION).doc(uid).get();
  if (!doc.exists) {
    throw appError(404, notFoundCode, notFoundMessage);
  }

  return { id: doc.id, ...doc.data() };
}

async function upsertUserProfile(uid, data) {
  const userRef = db.collection(USERS_COLLECTION).doc(uid);
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const existing = snap.exists ? snap.data() : null;

    const update = {
      ...data,
      updatedAt: serverTimestamp,
    };

    if (!existing || existing.createdAt == null) {
      update.createdAt = serverTimestamp;
    }

    tx.set(userRef, update, { merge: true });
  });
}

async function listUsersByRole(role, options = {}) {
  const limit = normalizeLimit(options.limit, 100);

  try {
    const snap = await db
      .collection(USERS_COLLECTION)
      .where('role', '==', role)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    if (!isFirestoreIndexRequiredError(err)) throw err;

    const snap = await db
      .collection(USERS_COLLECTION)
      .where('role', '==', role)
      .limit(200)
      .get();

    return snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      .slice(0, limit);
  }
}

module.exports = {
  getUserProfile,
  upsertUserProfile,
  listUsersByRole,
};
```

### `src/services/roles.service.js`

```js
'use strict';

// Firebase Custom Claims + Firestore sync for user roles.

const { admin, auth, db } = require('../firebase');
const { appError } = require('../utils/errors');

const USERS_COLLECTION = 'users';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

async function assignUserRole(uid, role) {
  if (!isNonEmptyString(uid)) {
    throw appError(400, 'INVALID_INPUT', 'uid is required.');
  }
  if (!isNonEmptyString(role)) {
    throw appError(400, 'INVALID_ROLE', 'role is required.');
  }

  const normalizedUid = uid.trim();
  const normalizedRole = role.trim();

  // 1) Read existing claims so we can merge/rollback safely.
  let userRecord;
  let previousClaims = null;
  try {
    userRecord = await auth.getUser(normalizedUid);
    previousClaims =
      userRecord.customClaims && typeof userRecord.customClaims === 'object'
        ? userRecord.customClaims
        : null;
  } catch (err) {
    console.error('[roles] Failed to read user record:', err);
    throw appError(500, 'USER_READ_FAILED', 'Unable to read user record.');
  }

  const nextClaims = { ...(previousClaims || {}), role: normalizedRole };

  // 2) Write custom claims.
  try {
    await auth.setCustomUserClaims(normalizedUid, nextClaims);
  } catch (err) {
    console.error('[roles] Failed to set custom claims:', err);
    throw appError(500, 'CLAIMS_WRITE_FAILED', 'Unable to assign role.');
  }

  // 3) Sync Firestore user doc.
  const userRef = db.collection(USERS_COLLECTION).doc(normalizedUid);
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const existing = snap.exists ? snap.data() : null;

      const update = {
        role: normalizedRole,
        status: 'active',
        updatedAt: serverTimestamp,
      };

      if (isNonEmptyString(userRecord.email)) {
        update.email = userRecord.email.trim();
      }

      if (!existing || existing.createdAt == null) {
        update.createdAt = serverTimestamp;
      }

      tx.set(userRef, update, { merge: true });
    });
  } catch (err) {
    console.error('[roles] Failed to sync Firestore user doc after setting claims:', err);

    // Best-effort rollback: restore original claims so we don't leave inconsistent state.
    try {
      const restoreClaims =
        previousClaims && Object.keys(previousClaims).length > 0 ? previousClaims : null;
      await auth.setCustomUserClaims(normalizedUid, restoreClaims);
    } catch (rollbackErr) {
      console.error('[roles] Failed to rollback custom claims after Firestore failure:', rollbackErr);
    }

    throw appError(500, 'FIRESTORE_SYNC_FAILED', 'Unable to persist role assignment.');
  }

  return {
    uid: normalizedUid,
    role: normalizedRole,
    email: isNonEmptyString(userRecord.email) ? userRecord.email.trim() : null,
  };
}

module.exports = {
  assignUserRole,
};
```

### `src/locks/employeeLock.service.js`

```js
'use strict';

// Employee lock service (Firestore).
//
// Goal:
// - Prevent an employee from being assigned/working on multiple active jobs at the same time.
//
// Data model: employeeLocks/{employeeId}
// - activeJobId: string | null
// - updatedAt: serverTimestamp
//
// IMPORTANT:
// - These functions are designed to be used INSIDE an existing Firestore transaction.

const { admin, db } = require('../firebase');
const { appError } = require('../utils/errors');

const COLLECTION = 'employeeLocks';

function lockRef(employeeId) {
  return db.collection(COLLECTION).doc(employeeId);
}

function requireTx(tx) {
  if (!tx) {
    throw new TypeError('employeeLock.service requires a Firestore transaction (tx).');
  }
}

function requireId(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
}

async function acquireLock(tx, employeeId, jobId) {
  requireTx(tx);
  requireId(employeeId, 'employeeId');
  requireId(jobId, 'jobId');

  const ref = lockRef(employeeId);
  const snap = await tx.get(ref);

  if (snap.exists) {
    const data = snap.data() || {};
    const activeJobId = typeof data.activeJobId === 'string' ? data.activeJobId : null;

    if (activeJobId && activeJobId !== jobId) {
      throw appError(409, 'EMPLOYEE_LOCKED', 'Employee already has an active job.');
    }
  }

  tx.set(
    ref,
    {
      activeJobId: jobId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function releaseLock(tx, employeeId, jobId) {
  requireTx(tx);
  requireId(employeeId, 'employeeId');
  requireId(jobId, 'jobId');

  const ref = lockRef(employeeId);
  const snap = await tx.get(ref);

  if (!snap.exists) return;

  const data = snap.data() || {};
  const activeJobId = typeof data.activeJobId === 'string' ? data.activeJobId : null;

  // Only release if the lock is held by this job (best-effort safety).
  if (activeJobId !== jobId) return;

  tx.set(
    ref,
    {
      activeJobId: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

module.exports = {
  acquireLock,
  releaseLock,
};
```

### `src/utils/response.js`

```js
'use strict';

function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

function fail(res, status, code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;

  return res.status(status).json({
    ok: false,
    error,
  });
}

module.exports = {
  ok,
  fail,
};
```

### `src/utils/errors.js`

```js
'use strict';

function appError(status, code, message, details) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  if (details !== undefined) err.details = details;
  return err;
}

function isFirestoreIndexRequiredError(err) {
  // Firestore typically throws:
  // - code: 9 (FAILED_PRECONDITION)
  // - message containing "requires an index"
  const message = err && typeof err.message === 'string' ? err.message : '';
  const code = err && (err.code || err.status);

  const looksLikeFailedPrecondition = code === 9 || code === 'FAILED_PRECONDITION';
  const mentionsIndex = message.toLowerCase().includes('requires an index');

  return Boolean(looksLikeFailedPrecondition && mentionsIndex);
}

module.exports = {
  appError,
  isFirestoreIndexRequiredError,
};
```

### `src/_deprecated/README.md`

```md
# Deprecated Code (Do Not Use)

This folder contains legacy/duplicated code kept temporarily to avoid breaking existing work while the codebase is being normalized.

## Rules
- Do not import from `src/_deprecated` in production code.
- Prefer the non-deprecated replacement mentioned below.

## Items

### `src/_deprecated/middlewares/boss.middleware..js`
- **Why**: Duplicate of role checks already handled by `src/middleware/requireRole.js` and route mounting in `src/index.js`.
- **Replacement**: Use `requireRole('boss')` (and `auth`) instead.

### `src/_deprecated/routes/job.routes.mock.js`
- **Why**: In-memory mock jobs API replaced by Firestore-backed endpoints in:
  - `src/routes/client.routes.js` (`/api/client/jobs`)
  - `src/routes/employee.routes.js` (`/api/employee/jobs`)
  - `src/routes/boss.routes.js` (`/api/boss/jobs`)
- **Replacement**: Use the role-specific routes above.
```

### `src/_deprecated/routes/job.routes.mock.js`

```js
'use strict';

// DEPRECATED: This in-memory mock has been replaced by Firestore-backed routes.
// Kept for reference only; do not mount in production.

// Mock Jobs API (in-memory).
// NOTE: This is a temporary implementation. Data resets on server restart.
// Auth/roles are handled at the app mounting level in `src/index.js`.

const express = require('express');

const router = express.Router();

// In-memory mock "database"
const JOBS = [];
let nextJobId = 1;

function sendOk(res, data) {
  return res.status(200).json({ ok: true, data });
}

function sendError(res, status, code, message) {
  return res.status(status).json({
    ok: false,
    error: { code, message },
  });
}

function createJob(title) {
  const job = {
    id: String(nextJobId++),
    title,
    status: 'open',
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  JOBS.push(job);
  return job;
}

function findJobById(id) {
  return JOBS.find((job) => job.id === id) || null;
}

/* =========================
   CLIENT
========================= */

// GET /api/client/jobs
router.get('/client/jobs', (req, res) => {
  return sendOk(res, JOBS);
});

// POST /api/client/jobs
// Body: { "title": "string" }
router.post('/client/jobs', (req, res) => {
  const title = req.body && req.body.title;
  if (typeof title !== 'string' || title.trim() === '') {
    return sendError(res, 400, 'INVALID_INPUT', 'title must be a non-empty string.');
  }

  const job = createJob(title.trim());
  return sendOk(res, job);
});

/* =========================
   EMPLOYEE
========================= */

// GET /api/employee/jobs
router.get('/employee/jobs', (req, res) => {
  return sendOk(res, JOBS);
});

// POST /api/employee/jobs/:id/complete
router.post('/employee/jobs/:id/complete', (req, res) => {
  const jobId = req.params && req.params.id;
  const job = findJobById(jobId);

  if (!job) {
    return sendError(res, 404, 'NOT_FOUND', 'Job not found.');
  }

  if (job.status !== 'completed') {
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
  }

  return sendOk(res, job);
});

/* =========================
   BOSS
========================= */

// GET /api/boss/jobs
router.get('/boss/jobs', (req, res) => {
  return sendOk(res, JOBS);
});

module.exports = router;
```

### `src/_deprecated/middlewares/boss.middleware..js`

```js
'use strict';

const requireBoss = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'Not authenticated.' },
    });
  }

  if (req.user.role !== 'boss') {
    return res.status(403).json({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Boss role required.' },
    });
  }

  return next();
};

module.exports = { requireBoss };
```
