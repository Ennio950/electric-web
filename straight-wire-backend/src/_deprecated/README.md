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
