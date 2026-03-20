# Repository Audit

Project: Electric Web
Date: 2026-03-14
Execution mode: SAFE_ANALYSIS
Scope: read-only audit of the existing repository, plus creation of `autodev-lab/` workspace folders and this report.

## Executive Summary

Electric Web is a Node.js monorepo with:

- A production Express backend in `straight-wire-backend/`
- Multiple web frontends:
  - legacy multi-page HTML + vanilla JS served from the repo root and `assets/`
  - a React/Vite builder in `builder-react/`
  - a separate vanilla estimator host in `host-vanilla/`
- Shared TypeScript business logic in `packages/` and `engine/`
- An existing Expo/React Native mobile app in `apps/mobile/`

The repository is already partially prepared for multi-platform use because some domain modules are shared, and the Expo app already consumes the backend. The main migration problem is not "how to add mobile", but "how to make one canonical domain model and one canonical API/auth contract" before any Flutter rewrite.

## Project Architecture Overview

Current architecture by layer:

- Backend/API: `straight-wire-backend/`
  - Express 5 server
  - Firebase Admin for Auth + Firestore
  - Static hosting for legacy HTML pages, assets, builder output, and engine output
  - Socket.IO for realtime staff updates
  - Cloudinary-backed uploads
  - Puppeteer-backed estimate/PDF rendering
  - WhatsApp and Telegram notification services
- Legacy web portal: root `*.html` pages + `assets/js/`
  - Firebase Web Auth in browser
  - role gateway and backend role validation
  - backend-issued `HttpOnly` portal session cookie for protected portal flows
- React builder SPA: `builder-react/`
  - Vite + React + TypeScript
  - Access gate that validates role/session against backend endpoints
  - Uses shared estimator package
- Shared business logic:
  - `packages/estimator-core/` is a reusable TS calculation package
  - `packages/builder-domain/` is a reusable builder-domain package
  - `engine/` is another TS calculation/projection engine
  - `host-vanilla/js/core/` contains an older browser-side calculator stack
- Existing mobile app: `apps/mobile/`
  - Expo Router
  - Firebase Auth
  - Typed backend API client
  - role-based route groups for `boss`, `employee`, `client`, and `builder`

## Repository Structure Tree

The tree below is intentionally trimmed to the important source/config areas and excludes `node_modules`, `dist`, `.expo`, and temporary output folders.

```text
.
|-- apps
|   +-- mobile
|       |-- app
|       |   |-- (auth)
|       |   |-- (boss)
|       |   |-- (builder)
|       |   |-- (client)
|       |   |-- (employee)
|       |   |-- _layout.tsx
|       |   |-- +not-found.tsx
|       |   +-- index.tsx
|       |-- assets
|       |-- src
|       |   |-- components
|       |   |-- config
|       |   |-- hooks
|       |   |-- lib
|       |   |-- providers
|       |   |-- stores
|       |   |-- theme
|       |   +-- types
|       |-- .env.example
|       |-- app.json
|       |-- eas.json
|       |-- package.json
|       +-- tsconfig.json
|-- assets
|   |-- css
|   |-- images
|   |-- js
|   |   |-- api.js
|   |   |-- auth.js
|   |   |-- auth-boss.js
|   |   |-- auth-apply.js
|   |   |-- firebase.js
|   |   |-- login-gateway.js
|   |   |-- marketplace-api.js
|   |   |-- portal-session.js
|   |   |-- role-gateway.js
|   |   +-- runtime-config.js
|   +-- vendor
|       |-- face-api
|       |-- firebase
|       |-- html2pdf
|       |-- leaflet
|       +-- three
|-- builder-react
|   |-- src
|   |   |-- app
|   |   |-- bridge
|   |   |-- components
|   |   |-- core
|   |   |-- data
|   |   |-- features
|   |   |-- lib
|   |   |-- schemas
|   |   |-- storage
|   |   |-- store
|   |   +-- ui
|   |-- tests
|   |-- package.json
|   |-- postcss.config.cjs
|   |-- tailwind.config.ts
|   |-- tsconfig.json
|   |-- vite.config.ts
|   +-- vitest.config.ts
|-- deploy
|   |-- nginx
|   |-- pm2
|   |-- systemd
|   +-- DEPLOY_SELF_HOST.md
|-- e2e
|-- engine
|   |-- expression
|   |-- index.ts
|   |-- runProjection.ts
|   |-- validateTemplate.ts
|   +-- tsconfig.json
|-- host-vanilla
|   |-- css
|   |-- data
|   |-- js
|   |   |-- core
|   |   +-- ui
|   |-- templates
|   |-- engine-adapter.js
|   |-- host.js
|   +-- materiales.html
|-- packages
|   |-- builder-domain
|   |   +-- src
|   +-- estimator-core
|       +-- src
|-- straight-wire-backend
|   |-- src
|   |   |-- _deprecated
|   |   |-- config
|   |   |-- controllers
|   |   |-- locks
|   |   |-- middleware
|   |   |-- routes
|   |   |-- services
|   |   |-- utils
|   |   |-- firebase.js
|   |   |-- index.js
|   |   +-- marketplace.constants.js
|   |-- tests
|   |-- .env
|   |-- .env.example
|   |-- .env.local
|   |-- .env.production.example
|   |-- firebase.json
|   |-- firestore.indexes.json
|   |-- firestore.rules
|   |-- package.json
|   +-- serviceAccount.example.json
|-- tests
|-- client-requests.html
|-- emergency.html
|-- estimate-form.html
|-- estimate-history.html
|-- estimate-template.html
|-- firestore.rules
|-- index.html
|-- login-empleado.html
|-- login-gateway.html
|-- login-jefe.html
|-- materials.html
|-- package.json
|-- panel-cliente.html
|-- panel-empleado.html
|-- panel-jefe.html
|-- playwright.config.ts
|-- README.md
|-- schedule.html
+-- tsconfig.base.json
```

## Backend Folders

- `straight-wire-backend/src/config`
- `straight-wire-backend/src/controllers`
- `straight-wire-backend/src/locks`
- `straight-wire-backend/src/middleware`
- `straight-wire-backend/src/routes`
- `straight-wire-backend/src/services`
- `straight-wire-backend/src/utils`

Supporting backend files:

- `straight-wire-backend/src/index.js`
- `straight-wire-backend/src/firebase.js`
- `straight-wire-backend/src/marketplace.constants.js`

## Frontend Folders

Web frontends:

- Root legacy HTML pages: `index.html`, `login-*.html`, `panel-*.html`, `client-requests.html`, `emergency.html`, `estimate-*.html`, `materials.html`, `schedule.html`
- Shared web assets: `assets/`
- React builder SPA: `builder-react/`
- Legacy/standalone builder host: `host-vanilla/`

Mobile frontend already present:

- `apps/mobile/`

Shared UI/domain code used by frontends:

- `packages/estimator-core/`
- `packages/builder-domain/`
- `engine/`

## Configuration Files

Workspace/root:

- `package.json`
- `tsconfig.base.json`
- `playwright.config.ts`
- `firestore.rules`

React builder:

- `builder-react/package.json`
- `builder-react/tsconfig.json`
- `builder-react/vite.config.ts`
- `builder-react/vitest.config.ts`
- `builder-react/tailwind.config.ts`
- `builder-react/postcss.config.cjs`

Mobile:

- `apps/mobile/package.json`
- `apps/mobile/tsconfig.json`
- `apps/mobile/app.json`
- `apps/mobile/eas.json`
- `apps/mobile/.env.example`

Backend:

- `straight-wire-backend/package.json`
- `straight-wire-backend/.env`
- `straight-wire-backend/.env.local`
- `straight-wire-backend/.env.example`
- `straight-wire-backend/.env.production.example`
- `straight-wire-backend/firebase.json`
- `straight-wire-backend/firestore.rules`
- `straight-wire-backend/firestore.indexes.json`
- `straight-wire-backend/serviceAccount.example.json`

Deployment:

- `deploy/nginx/straight-wire-electric.conf`
- `deploy/systemd/straight-wire-electric.service`
- `deploy/pm2/ecosystem.config.cjs`

## Detected Project Stack

Core platform:

- Node.js
- npm workspaces monorepo
- TypeScript

Backend:

- Express 5
- Firebase Admin SDK
- Firestore
- Firebase Auth custom claims + session cookies
- Socket.IO
- Helmet
- CORS
- express-rate-limit
- Morgan
- Multer
- Cloudinary
- Puppeteer
- Zod

Web frontend:

- Legacy HTML/CSS/vanilla JS
- Firebase Web SDK
- React 18
- Vite 5
- React Router
- TanStack React Query
- Zustand
- Tailwind CSS
- Radix UI

Mobile frontend already in repo:

- Expo 55
- React Native 0.83
- Expo Router
- Firebase JS SDK
- AsyncStorage
- Secure Store
- Expo Camera
- Expo Notifications
- Expo Location

Testing/tooling:

- Node test runner
- Vitest
- Playwright
- concurrently

## Detected Services

- Express API server in `straight-wire-backend/src/index.js`
- Static hosting for legacy portal pages and built SPA assets
- Firebase Auth verification and Firebase session-cookie minting
- Firestore data access layer
- Socket.IO realtime channel for staff/job rooms
- Cloudinary media upload pipeline
- Puppeteer PDF/estimate rendering pipeline
- WhatsApp notifications, webhook handling, and Twilio integration hooks
- Telegram notifications
- Mobile push-token registry for Expo notifications
- Company configuration service
- Notification settings service

## Authentication System Explanation

There are three auth patterns in the repo:

### 1. Legacy web portal auth

Files involved:

- `assets/js/firebase.js`
- `assets/js/auth.js`
- `assets/js/auth-boss.js`
- `assets/js/login-gateway.js`
- `assets/js/role-gateway.js`
- `assets/js/portal-session.js`
- `straight-wire-backend/src/routes/auth.routes.js`
- `straight-wire-backend/src/middleware/verifyFirebaseToken.js`
- `straight-wire-backend/src/services/requestAuth.service.js`
- `straight-wire-backend/src/middleware/sessionCsrf.js`
- `straight-wire-backend/src/utils/authTokens.js`

Flow:

1. Browser signs in with Firebase Web Auth.
2. Frontend calls backend role-validation endpoints such as:
   - `/api/client/me`
   - `/api/employee/me`
   - `/api/boss/me`
3. `role-gateway.js` determines the effective role.
4. `portal-session.js` calls `POST /auth/portal-session` with the Firebase ID token.
5. Backend mints:
   - `swe_portal_session` as `HttpOnly` session cookie
   - `swe_portal_csrf` as readable CSRF cookie
6. Subsequent portal requests can be authorized by either:
   - Bearer Firebase ID token
   - Session cookie
7. Unsafe cookie-based requests require CSRF header validation.

### 2. Mobile auth

Files involved:

- `apps/mobile/src/config/firebase.ts`
- `apps/mobile/src/providers/SessionBootstrap.tsx`
- `apps/mobile/src/stores/sessionStore.ts`
- `apps/mobile/src/lib/api.ts`
- `apps/mobile/app/(auth)/*`

Flow:

1. Mobile app signs in via Firebase Auth.
2. `SessionBootstrap` listens to `onIdTokenChanged`.
3. App exchanges the current ID token with backend bootstrap endpoint:
   - `GET /api/mobile/bootstrap`
4. Backend returns role-specific bootstrap payload.
5. Route groups are gated by role:
   - `(boss)`
   - `(employee)`
   - `(client)`
   - `(builder)`

### 3. Public and magic auth flows

Files involved:

- `straight-wire-backend/src/controllers/auth.magic.controller.js`
- `straight-wire-backend/src/services/publicRequests.service.js`
- `straight-wire-backend/src/services/auth.service.js`
- `straight-wire-backend/src/services/roles.service.js`

Behavior:

- `POST /auth/google` accepts a Firebase Google ID token, forces/validates `client` role, then mints a custom token and returns a fresh ID token.
- `POST /auth/magic/start` and `POST /auth/magic/verify` implement client OTP login.
- Public request flow can create/reuse a Firebase user by email, assign `client`, mint a custom token, and create a request/job without password login.

### Role source of truth

Role resolution is split across:

- Firebase custom claims
- Firestore `users/{uid}.role`

Backend code consistently falls back to Firestore when claims are missing.

## Roles (boss / employee / client)

Role model detected in code:

- `boss`
  - reviews and assigns requests
  - approves employee requests and employee photo changes
  - manages company config and notification settings
  - reviews payment proofs
  - sees earnings and review queue
- `employee`
  - claims jobs/requests
  - submits proposals and proof of work/payment
  - updates own profile and requests photo changes
  - can apply for employee access from the web/mobile login flows
- `client`
  - creates requests and emergency calls
  - views own jobs/requests
  - accepts or rejects proposals
  - closes completed work and uploads payment proof
  - can sign up or use magic login

## API Endpoints

### Mounted routers

- `/health`
- `/auth`
- `/public`
- `/client`
- `/employee`
- `/boss`
- `/api`
- `/api/client`
- `/api/employee`
- `/api/mobile`
- `/api/uploads`
- `/api/marketplace`
- `/api/employees`
- `/api/hooks/whatsapp`

### Health

- `GET /health`

### Auth

- `GET /auth/me`
- `POST /auth/portal-session`
- `DELETE /auth/portal-session`
- `POST /auth/ensure-user`
- `POST /auth/google`
- `POST /auth/magic/start`
- `POST /auth/magic/verify`

### Public

- `GET /public/company-config`
- `POST /public/requests`

### Client routes

Mounted under both `/client` and `/api/client`:

- `GET /me`
- `POST /register`
- `GET /jobs`
- `POST /jobs`
- `POST /requests`
- `GET /requests/latest`
- `GET /requests/:id`
- `POST /requests/:id/close`

### Employee routes

Mounted under `/employee`:

- `GET /dashboard`
- `GET /requests`
- `POST /requests/:id/claim`
- `POST /applications`

Mounted under `/api/employee`:

- `GET /jobs`
- `POST /jobs/:jobId/accept`
- `POST /jobs/:jobId/status`

Additional role check endpoint:

- `GET /api/employee/me`

### Boss routes

Mounted under both `/boss` and `/api/boss`:

- `GET /me`
- `GET /company-config`
- `PUT /company-config`
- `GET /notifications/settings`
- `PUT /notifications/settings`
- `GET /notifications/channels`
- `POST /notifications/whatsapp/test`
- `POST /notifications/telegram/test`
- `GET /requests`
- `POST /requests/:id/assign`
- `GET /employee-requests`
- `POST /employee-requests/:id/approve`
- `POST /employee-requests/:id/reject`
- `GET /photo-change-requests`
- `POST /photo-change-requests/:id/approve`
- `POST /photo-change-requests/:id/reject`

### Legacy/parallel request API under `/api`

- Client request flow:
  - `POST /api/client/requests`
  - `GET /api/client/requests/active`
  - `GET /api/client/requests`
  - `POST /api/client/requests/:id/confirm`
  - `POST /api/client/requests/:id/approve`
  - `POST /api/client/requests/:id/ok`
  - `POST /api/client/requests/:id/photo`
- Employee request flow:
  - `GET /api/employee/requests`
  - `POST /api/employee/requests/:id/claim`
  - `POST /api/employee/requests/:id/submit-proof`
  - `POST /api/employee/requests/:id/mark-awaiting-client`
  - `POST /api/employee/requests/:id/complete`
- Boss request flow:
  - `GET /api/boss/requests`
  - `POST /api/boss/assign-request`
  - `POST /api/boss/requests/:id/close`
  - `PATCH /api/boss/requests/:id/force`
  - `POST /api/boss/requests/:id/force-close`
- Profiles/debug:
  - `GET /api/employee/profile/:employeeUid`
  - `GET /api/debug/state`

### Mobile API

- `GET /api/mobile/bootstrap`
- `GET /api/mobile/home`
- `POST /api/mobile/push-tokens`
- `DELETE /api/mobile/push-tokens/:token`

### Upload API

- `POST /api/uploads/image`

### Employee profile API

- `GET /api/employees/:id/profile`
- `PATCH /api/employees/me`
- `GET /api/employees/me/photo-change`
- `POST /api/employees/me/photo-change/request`
- `POST /api/employees/me/photo-change/submit`

### WhatsApp webhook API

- `GET /api/hooks/whatsapp/`
- `POST /api/hooks/whatsapp/send`

### Marketplace API

Client-facing:

- `POST /api/marketplace/requests`
- `POST /api/marketplace/emergency-calls`
- `GET /api/marketplace/requests`
- `GET /api/marketplace/emergency-calls`
- `GET /api/marketplace/emergency-calls/:id`
- `GET /api/marketplace/requests/:id`
- `DELETE /api/marketplace/requests/:id`
- `POST /api/marketplace/requests/:id/accept-proposal`
- `POST /api/marketplace/requests/:id/reject-proposal`
- `POST /api/marketplace/requests/:id/close`
- `POST /api/marketplace/requests/:id/payment-proof`
- `POST /api/marketplace/emergency-calls/:id/close`
- `GET /api/marketplace/requests/:id/estimate-url`

Employee-facing:

- `GET /api/marketplace/requests/available`
- `GET /api/marketplace/employee/my-requests`
- `GET /api/marketplace/employee/active-job`
- `POST /api/marketplace/quote-number/next`
- `POST /api/marketplace/requests/:id/claim`
- `POST /api/marketplace/requests/:id/release`
- `POST /api/marketplace/emergency-calls/:id/accept`
- `POST /api/marketplace/emergency-calls/:id/resolve`
- `POST /api/marketplace/emergency-calls/:id/payment-proof`
- `POST /api/marketplace/emergency-calls/:id/notify-boss-payment`
- `POST /api/marketplace/emergency-calls/:id/location`
- `DELETE /api/marketplace/emergency-calls/:id`
- `POST /api/marketplace/requests/:id/proposal`
- `POST /api/marketplace/requests/:id/finish`
- `POST /api/marketplace/render-estimate`
- `POST /api/marketplace/upload-estimate`

Boss-facing:

- `GET /api/marketplace/boss/requests`
- `GET /api/marketplace/boss/employees`
- `GET /api/marketplace/boss/payments/pending`
- `GET /api/marketplace/boss/review-queue`
- `GET /api/marketplace/boss/earnings`
- `POST /api/marketplace/requests/:id/approve-payment`
- `POST /api/marketplace/requests/:id/reject-payment`
- `POST /api/marketplace/boss/requests/:id/assign`
- `POST /api/marketplace/boss/requests/:id/unassign`
- `POST /api/marketplace/boss/emergency-calls/:id/assign`
- `POST /api/marketplace/emergency-calls/:id/approve-payment`
- `POST /api/marketplace/emergency-calls/:id/reject-payment`

Chat:

- `GET /api/marketplace/requests/:id/chat`
- `POST /api/marketplace/requests/:id/chat`
- `GET /api/marketplace/emergency-calls/:id/chat`
- `POST /api/marketplace/emergency-calls/:id/chat`

### Not mounted

Route file present but not mounted from `src/index.js`:

- `straight-wire-backend/src/routes/admin.bootstrap.routes.js`
  - `POST /admin/bootstrap-boss`
  - `POST /admin/assign-role`

This is effectively dormant code unless mounted later.

## Database Usage

Primary database:

- Firebase Firestore

Auth:

- Firebase Authentication
- Firebase custom claims are used for role assignment

Media:

- Cloudinary for uploaded images and generated asset URLs

Client/mobile local persistence:

- `localStorage` in legacy web and builder session helpers
- AsyncStorage and SecureStore in Expo mobile

## Database Collections / Models

Collections and documents detected from the backend services and rules:

- `users`
  - role fallback
  - user profile document
- `jobs`
  - legacy/backend-first CRM jobs
- `clientRequests`
  - client request lifecycle used by older API surface
- `clientLocks`
  - prevents duplicate active client requests
- `employeeLocks`
  - prevents employee double-assignment
- `employeeRequests`
  - employee application / approval queue
- `employeePhotoRequests`
  - employee photo-change approval flow
- `employees`
  - employee-specific data
  - subcollections:
    - `portfolio`
    - `history`
- `requests`
  - canonical marketplace request lifecycle
  - subcollection:
    - `chat`
- `emergencyCalls`
  - emergency workflow
  - subcollection:
    - `chat`
- `proposals`
  - marketplace proposals
- `earnings`
  - boss commission tracking
- `auditLogs`
  - audit trail and pro-action logging
- `magicChallenges`
  - OTP / magic-login challenge storage
- `mobilePushTokens`
  - Expo push-token registry
- `system`
  - document `companyConfig`
  - document `notificationSettings`
  - document `quoteCounter`

Security/config drift detected:

- Root `firestore.rules` and `straight-wire-backend/firestore.rules` are not the same ruleset.
- Rules reference collections like `chatRateLimits` and `clientCounters` that are not obvious in the active backend service layer.

## Dependencies

### Root workspace

- `typescript`
- `@playwright/test`
- `concurrently`

### Backend

- `express`
- `firebase-admin`
- `socket.io`
- `cloudinary`
- `multer`
- `puppeteer`
- `helmet`
- `cors`
- `express-rate-limit`
- `morgan`
- `dotenv`
- `zod`
- `@opentelemetry/api`

### React builder

- `react`
- `react-dom`
- `react-router-dom`
- `@tanstack/react-query`
- `zustand`
- `react-hook-form`
- `zod`
- `@radix-ui/*`
- `tailwindcss`
- `vite`

### Mobile

- `expo`
- `expo-router`
- `firebase`
- `@tanstack/react-query`
- `zustand`
- `@react-native-async-storage/async-storage`
- `expo-secure-store`
- `expo-camera`
- `expo-location`
- `expo-notifications`
- `expo-image-picker`
- `expo-file-system`

### Shared packages

- `@electric/estimator-core`
- `@electric/builder-domain`

## Important Modules

Highest-signal modules for future migration work:

- `packages/estimator-core/`
  - most reusable calculation core in the repo
- `packages/builder-domain/`
  - reusable builder-domain helpers and factories
- `straight-wire-backend/src/marketplace.constants.js`
  - canonical marketplace state machine and role transitions
- `straight-wire-backend/src/services/marketplace.service.js`
  - core request/emergency workflow logic
- `straight-wire-backend/src/services/jobs.service.js`
  - legacy CRM job flow
- `straight-wire-backend/src/services/companyConfig.service.js`
  - tenant/company configuration consumed across clients
- `straight-wire-backend/src/utils/mobileContracts.js`
  - typed mobile bootstrap/home contracts
- `apps/mobile/src/lib/api.ts`
  - de facto typed reference for backend endpoint usage
- `builder-react/src/app/portalAccess.ts`
  - current builder access/session contract
- `assets/js/role-gateway.js`
  - legacy web role resolution and session establishment

## Code Modules That Must Be Migrated First

Recommended migration order for a future Flutter app:

1. `packages/estimator-core/`
   - This is the best candidate to become the canonical estimator/business engine in Dart.
2. `packages/builder-domain/`
   - Tree structure, IDs, presets, and builder factories should become Flutter-domain packages.
3. Backend API contracts
   - Use `apps/mobile/src/lib/api.ts` and backend route files as the source for DTO mapping and role-based use cases.
4. Marketplace state machine
   - Port the request/emergency status model from `marketplace.constants.js` into Flutter domain entities and enums.
5. Auth/session abstraction
   - Flutter should only keep Firebase Auth + backend token/session rules, without inheriting the legacy browser cookie assumptions.
6. Company config and employee-profile modules
   - These are shared business concerns that affect all roles and all clients.

## Potential Migration Risks

### 1. Multiple overlapping business engines

Calculation and builder logic exists in several places:

- `host-vanilla/js/core/`
- `engine/`
- `packages/estimator-core/`
- `builder-react/src/core/`

Observed reality:

- `builder-react/src/core/calculator.ts` already re-exports `@electric/estimator-core`
- `engine/runProjection.ts` is a separate projection engine
- `host-vanilla/js/core/calculator.js` is another separate browser-side calculator

Risk:

- A Flutter rewrite can accidentally port the wrong engine unless one canonical ruleset is chosen first.

### 2. Parallel API surfaces

There are overlapping flows for:

- `/client` and `/api/client`
- `/boss` and `/api/boss`
- `/api/*` request APIs
- `/api/marketplace/*` request APIs
- `jobs` and `requests` as separate concepts
- `clientRequests` and `requests` as separate Firestore collections

Risk:

- Flutter could bind to an API surface that is already transitional or partially deprecated.

### 3. Mixed authentication modes

The system uses:

- Firebase ID tokens
- backend-issued session cookies
- CSRF tokens for cookie-backed requests
- custom token exchange for public/magic flows

Risk:

- Browser-specific session behavior should not be copied directly into Flutter.
- Flutter should use Firebase Auth tokens and backend APIs, not legacy portal cookies.

### 4. Firestore schema drift

Schema is not fully centralized:

- root `firestore.rules`
- backend `firestore.rules`
- backend `firestore.indexes.json`
- live code in services

Risk:

- Security rules, indexes, and actual service-layer behavior can drift apart.

### 5. Role source split

Roles come from:

- Firebase custom claims
- Firestore `users/{uid}.role`

Risk:

- Claims/user-doc mismatch can create intermittent permission bugs across web/mobile/Flutter.

### 6. Legacy and dormant code

- `straight-wire-backend/src/_deprecated/`
- unmounted `admin.bootstrap.routes.js`
- commented legacy chat routes

Risk:

- It is easy to port obsolete behavior by mistake.

### 7. Existing Expo app changes the migration strategy

There is already a mobile client in `apps/mobile/`.

Risk:

- A Flutter initiative is not a first mobile app build; it is a second mobile codebase.
- Product flows may diverge unless the current mobile API contracts and role flows are stabilized first.

### 8. Hard-coded Firebase config in frontend code

Detected in:

- `assets/js/firebase.js`
- `apps/mobile/src/config/mobileEnv.ts`

Risk:

- Environment/config handling is currently partially code-level, which complicates secure multi-environment rollout.

## Recommended Flutter Architecture

Recommended target architecture for the future Flutter app:

### Application structure

- `apps/flutter_app/`
- `packages/electric_domain/`
- `packages/electric_estimator/`
- `packages/electric_api/`
- `packages/electric_auth/`

### Layering

- Presentation
  - feature folders by role and business capability
  - client, employee, boss, builder
- Application
  - use cases and controllers per feature
- Domain
  - entities, enums, state machines, value objects
- Data
  - Firebase Auth adapter
  - backend REST client
  - local cache/persistence

### Suggested Flutter stack

- State management: Riverpod
- Routing: GoRouter
- HTTP client: Dio
- Models: Freezed + json_serializable
- Auth: `firebase_auth`
- Secure token storage: `flutter_secure_storage`
- Local persistence/offline cache: Drift or Isar

### Migration principles

- Keep Express backend as the initial backend of record.
- Do not port browser portal-session cookie logic into Flutter.
- Model roles and workflows as typed enums/value objects in Dart.
- Move only one canonical estimator engine into Dart.
- Use the existing Expo mobile app as a functional spec for screens, flows, and endpoint contracts.

## Recommended Next Development Step

The next step should be contract consolidation, not UI migration.

Recommended Step 2:

1. Choose the canonical business engine:
   - likely `packages/estimator-core/` for estimation logic
   - likely `straight-wire-backend/src/marketplace.constants.js` for request workflow
2. Freeze the canonical API surface for Flutter:
   - prefer `/api/mobile/*`, `/api/marketplace/*`, `/api/employees/*`, `/auth/*`
   - document or retire overlapping legacy endpoints
3. Freeze Firestore collections and rules:
   - pick one canonical `firestore.rules`
   - align indexes and services
4. Generate a machine-readable contract:
   - endpoint inventory
   - DTOs
   - role permissions
   - collection schema notes

## Audit Conclusion

Electric Web is not a single web app. It is a mixed monorepo with:

- legacy web portals
- a newer React builder
- a production Node/Firebase backend
- shared TS domain packages
- an already-started mobile app

The repository is viable for autonomous migration work, but only after reducing duplication in domain logic, API surfaces, and Firestore security/config ownership.
