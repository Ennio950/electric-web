import { Platform } from 'react-native';

export type MobileReleaseStage = 'development' | 'preview' | 'production';
export type MobileUrlQueryValue = string | number | boolean | null | undefined;
export type MobileUrlQuery = Record<string, MobileUrlQueryValue>;

function cleanOptionalEnv(value: string | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function normalizeUrlPath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

function appendQueryParams(url: URL, query?: MobileUrlQuery) {
  if (!query) {
    return;
  }

  Object.entries(query).forEach(([key, value]) => {
    if (value == null) {
      return;
    }

    const normalized = typeof value === 'string' ? value.trim() : String(value);
    if (!normalized) {
      return;
    }

    url.searchParams.set(key, normalized);
  });
}

function cleanEnv(value: string | undefined, fallback: string) {
  return cleanOptionalEnv(value) ?? fallback;
}

function getWebOriginFallback() {
  const location = (globalThis as { location?: { origin?: string } }).location;
  const origin = typeof location?.origin === 'string' ? location.origin.trim() : '';
  return normalizeBaseUrl(origin || 'http://127.0.0.1:8081');
}

const nativeDevApiBaseUrl = Platform.select({
  // Expo/Metro occupies :8081 in native dev, so the backend runs on :8090 locally.
  android: 'http://10.0.2.2:8090',
  default: 'http://127.0.0.1:8090',
});

const nativeDevViewerBaseUrl = Platform.select({
  android: 'http://10.0.2.2:4318',
  default: 'http://127.0.0.1:4318',
});

function getReleaseStage(): MobileReleaseStage {
  const appEnv = cleanOptionalEnv(process.env.EXPO_PUBLIC_APP_ENV);
  if (appEnv === 'preview' || appEnv === 'production') {
    return appEnv;
  }

  return 'development';
}

let warnedAboutApiFallback = false;

export function getApiBaseUrl() {
  const configuredBaseUrl = cleanOptionalEnv(process.env.EXPO_PUBLIC_API_BASE_URL);
  if (configuredBaseUrl) {
    return normalizeBaseUrl(configuredBaseUrl);
  }

  if (Platform.OS === 'web') {
    return getWebOriginFallback();
  }

  const releaseStage = getReleaseStage();
  if (releaseStage !== 'development') {
    throw new Error(
      `[mobileEnv] EXPO_PUBLIC_API_BASE_URL es obligatoria para builds nativos ${releaseStage}.`,
    );
  }

  if (!warnedAboutApiFallback) {
    warnedAboutApiFallback = true;
    console.warn(
      '[mobileEnv] EXPO_PUBLIC_API_BASE_URL no esta configurada; la app nativa esta usando el fallback local de desarrollo.',
    );
  }

  return normalizeBaseUrl(nativeDevApiBaseUrl ?? 'http://127.0.0.1:8081');
}

export function buildApiUrl(path: string, query?: MobileUrlQuery) {
  const url = new URL(normalizeUrlPath(path), `${getApiBaseUrl()}/`);
  appendQueryParams(url, query);
  return url.toString();
}

export function getWorkflowViewerUrl() {
  const configuredBaseUrl = cleanOptionalEnv(process.env.EXPO_PUBLIC_WORKFLOW_VIEWER_URL);
  if (configuredBaseUrl) {
    return normalizeBaseUrl(configuredBaseUrl);
  }

  if (Platform.OS === 'web') {
    return 'http://127.0.0.1:4318';
  }

  return normalizeBaseUrl(nativeDevViewerBaseUrl ?? 'http://127.0.0.1:4318');
}

export function buildWorkflowViewerUrl(path: string, query?: MobileUrlQuery) {
  const url = new URL(normalizeUrlPath(path), `${getWorkflowViewerUrl()}/`);
  appendQueryParams(url, query);
  return url.toString();
}

export const firebaseWebConfig = {
  apiKey: cleanEnv(process.env.EXPO_PUBLIC_FIREBASE_API_KEY, 'AIzaSyDIlxPHbQnuQpKy0S9SOuiXxla7r6LE6WA'),
  authDomain: cleanEnv(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, 'straight-wire-electric.firebaseapp.com'),
  projectId: cleanEnv(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, 'straight-wire-electric'),
  storageBucket: cleanEnv(
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    'straight-wire-electric.firebasestorage.app',
  ),
  messagingSenderId: cleanEnv(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, '989475635196'),
  appId: cleanEnv(
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    '1:989475635196:web:3eb3eed7d653356178bc79',
  ),
};

export const googleAuthConfig = {
  androidClientId: cleanOptionalEnv(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
  iosClientId: cleanOptionalEnv(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
  webClientId: cleanOptionalEnv(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
};

export function getGoogleClientIdForPlatform() {
  const sharedFallback =
    googleAuthConfig.androidClientId ?? googleAuthConfig.iosClientId ?? googleAuthConfig.webClientId;

  if (Platform.OS === 'android') {
    return googleAuthConfig.androidClientId ?? googleAuthConfig.webClientId ?? sharedFallback;
  }

  if (Platform.OS === 'ios') {
    return googleAuthConfig.iosClientId ?? googleAuthConfig.webClientId ?? sharedFallback;
  }

  return googleAuthConfig.webClientId ?? sharedFallback;
}

export const devBossCredentials = {
  email: cleanOptionalEnv(process.env.EXPO_PUBLIC_DEV_BOSS_EMAIL),
  password: cleanOptionalEnv(process.env.EXPO_PUBLIC_DEV_BOSS_PASSWORD),
};
