/**
 * Sentry error tracking initialisation.
 *
 * Call `initSentry()` once, at the top of app/_layout.tsx (before rendering).
 * The DSN is read from the EXPO_PUBLIC_SENTRY_DSN environment variable.
 * Leave the variable unset in development to disable Sentry entirely.
 *
 * EAS build variables (eas.json / EAS dashboard) should provide:
 *   EXPO_PUBLIC_SENTRY_DSN  – the project DSN from sentry.io
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Lazily resolved so tree-shaking works in envs that don't ship Sentry.
let _Sentry: typeof import('@sentry/react-native') | null = null;

function getSentryDsn(): string | undefined {
  // Prefer explicit env var; fall back to nothing.
  const raw = process.env.EXPO_PUBLIC_SENTRY_DSN;
  return raw && raw.trim() ? raw.trim() : undefined;
}

export function initSentry() {
  const dsn = getSentryDsn();
  if (!dsn) {
    // DSN not configured — Sentry stays disabled (typical in development).
    return;
  }

  // Web builds skip native Sentry (no native modules available).
  if (Platform.OS === 'web') {
    return;
  }

  void (async () => {
    try {
      const Sentry = await import('@sentry/react-native');
      _Sentry = Sentry;

      const releaseStage =
        (Constants.expoConfig?.extra as { mobile?: { releaseStage?: string } } | undefined)
          ?.mobile?.releaseStage ?? 'development';

      Sentry.init({
        dsn,
        environment: releaseStage,
        // Capture 100 % of transactions in production; reduce if performance budget is tight.
        tracesSampleRate: releaseStage === 'production' ? 0.2 : 0,
        // Attach breadcrumbs for every console.* call in production.
        attachStacktrace: true,
        enabled: releaseStage !== 'development',
      });
    } catch {
      // Sentry init failure must never crash the app.
    }
  })();
}

/** Capture an unexpected error. Safe to call even if Sentry is disabled. */
export function captureError(err: unknown, context?: Record<string, unknown>) {
  if (!_Sentry) return;
  _Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    _Sentry!.captureException(err);
  });
}

/** Set the currently authenticated user so errors are linked to their account. */
export function setSentryUser(uid: string | null, email?: string | null) {
  if (!_Sentry) return;
  if (uid) {
    _Sentry.setUser({ id: uid, email: email ?? undefined });
  } else {
    _Sentry.setUser(null);
  }
}
