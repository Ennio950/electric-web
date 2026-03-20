/**
 * pushNotifications.ts — Expo Notifications SDK utilities.
 *
 * Responsibilities:
 *   - Android notification channel setup
 *   - Permission request
 *   - Expo push token acquisition (graceful fallback if not configured)
 *   - Persistent device ID via SecureStore
 *
 * This file does NOT touch the backend or Firebase auth.
 * Wiring to auth + API is done in PushTokenProvider.tsx.
 */

import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'electric_staff_device_id_v1';

type NotificationsModule = typeof import('expo-notifications');

function isExpoGo() {
  return Constants.executionEnvironment === 'storeClient';
}

function cleanOptionalValue(value: string | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
}

async function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web' || isExpoGo()) {
    return null;
  }

  try {
    return await import('expo-notifications');
  } catch (err) {
    console.warn('[pushNotifications] No se pudo cargar expo-notifications:', err);
    return null;
  }
}

// ─── Android channel ──────────────────────────────────────────────────────────

/**
 * Creates the default Android notification channel.
 * Safe to call multiple times — idempotent.
 * No-op on iOS and web.
 */
export async function setupAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notificaciones',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1A73E8',
      showBadge: true,
    });
  } catch (err) {
    console.warn('[pushNotifications] No se pudo crear el canal de Android:', err);
  }
}

// ─── Permission ───────────────────────────────────────────────────────────────

/**
 * Returns true if push permission is granted (or was just granted).
 * Returns false without throwing on denial or web.
 */
export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS === 'web' || isExpoGo()) return false;

  const Notifications = await loadNotificationsModule();
  if (!Notifications) return false;

  try {
    const { status: current } = await Notifications.getPermissionsAsync();
    if (current === 'granted') return true;
    if (current === 'denied') {
      console.warn('[pushNotifications] Permiso de notificaciones denegado por el usuario.');
      return false;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.warn('[pushNotifications] Error al solicitar permiso:', err);
    return false;
  }
}

// ─── Device ID ────────────────────────────────────────────────────────────────

/**
 * Returns a stable device ID persisted in SecureStore.
 * Falls back to an ephemeral ID if SecureStore is unavailable (simulators, web).
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (stored) return stored;
    const fresh = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await SecureStore.setItemAsync(DEVICE_ID_KEY, fresh);
    return fresh;
  } catch {
    return `${Platform.OS}-ephemeral-${Date.now()}`;
  }
}

// ─── Token ────────────────────────────────────────────────────────────────────

/**
 * Resolves the EAS projectId from:
 *   1. app.json  extra.eas.projectId  (via Constants.expoConfig)
 *   2. EAS build metadata           (via Constants.easConfig)
 *   3. env variable                 (EXPO_PUBLIC_EAS_PROJECT_ID)
 *
 * Returns undefined if none are set — callers should warn and bail.
 */
function resolveProjectId(): string | undefined {
  // app.json `extra.eas.projectId`
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const fromExtra = cleanOptionalValue(extra?.eas?.projectId);
  if (fromExtra) return fromExtra;

  // EAS build-time injection (expo-constants 17+)
  const easConfig = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig;
  const fromEasConfig = cleanOptionalValue(easConfig?.projectId);
  if (fromEasConfig) return fromEasConfig;

  // Explicit env var (works in Expo Go + dev builds)
  const fromEnv = cleanOptionalValue(process.env.EXPO_PUBLIC_EAS_PROJECT_ID);
  if (fromEnv) return fromEnv;

  return undefined;
}

/**
 * Requests permission and returns an Expo push token string.
 *
 * Returns null — without throwing — when:
 *   - running on web
 *   - permission is denied
 *   - EAS projectId is not configured (logs a warning)
 *   - the device/simulator rejects the call (emulators often do)
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web' || isExpoGo()) return null;

  const granted = await requestPushPermission();
  if (!granted) return null;

  const Notifications = await loadNotificationsModule();
  if (!Notifications) return null;

  const projectId = resolveProjectId();
  if (!projectId) {
    console.warn(
      '[pushNotifications] EAS projectId no encontrado. ' +
        'Agrega EXPO_PUBLIC_EAS_PROJECT_ID al .env para que app.config.ts lo inyecte en Expo, o usa una build de EAS con metadata completa. ' +
        'Push tokens no disponibles en esta build.',
    );
    return null;
  }

  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    return result.data;
  } catch (err) {
    // Common on Android emulators without Google Play Services
    console.warn('[pushNotifications] No se pudo obtener el Expo push token:', err);
    return null;
  }
}
