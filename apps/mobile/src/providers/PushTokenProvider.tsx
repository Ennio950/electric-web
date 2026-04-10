import type { User } from 'firebase/auth';
import Constants from 'expo-constants';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { deletePushToken, registerPushToken } from '@/src/lib/api';
import {
  getExpoPushToken,
  getOrCreateDeviceId,
  setupAndroidNotificationChannel,
} from '@/src/lib/pushNotifications';
import { useIsSessionBooting, useSessionAuthUser, useSessionBootstrap } from '@/src/stores/sessionStore';

export function PushTokenProvider() {
  const isBooting = useIsSessionBooting();
  const bootstrap = useSessionBootstrap();
  const authUser = useSessionAuthUser();

  const registeredTokenRef = useRef<string | null>(null);
  const registeredUidRef = useRef<string | null>(null);
  const registeredAuthTokenRef = useRef<string | null>(null);

  useEffect(() => {
    void setupAndroidNotificationChannel();
  }, []);

  useEffect(() => {
    if (isBooting) {
      return;
    }

    let cancelled = false;

    async function syncPushRegistration() {
      const activeUid = bootstrap?.user.uid ?? null;

      if (!activeUid || !authUser) {
        if (registeredTokenRef.current && registeredAuthTokenRef.current) {
          await unregisterPushToken({
            authToken: registeredAuthTokenRef.current,
            pushToken: registeredTokenRef.current,
          });
        }

        if (!cancelled) {
          registeredTokenRef.current = null;
          registeredUidRef.current = null;
          registeredAuthTokenRef.current = null;
        }
        return;
      }

      if (registeredUidRef.current === activeUid && registeredTokenRef.current) {
        return;
      }

      if (registeredTokenRef.current && registeredAuthTokenRef.current) {
        await unregisterPushToken({
          authToken: registeredAuthTokenRef.current,
          pushToken: registeredTokenRef.current,
        });
      }

      const registration = await registerCurrentUserPushToken(authUser);
      if (!registration || cancelled) {
        return;
      }

      registeredTokenRef.current = registration.pushToken;
      registeredUidRef.current = activeUid;
      registeredAuthTokenRef.current = registration.authToken;
    }

    void syncPushRegistration();

    return () => {
      cancelled = true;
    };
  }, [authUser, bootstrap?.user.uid, isBooting]);

  return null;
}

async function registerCurrentUserPushToken(authUser: User) {
  try {
    const pushToken = await getExpoPushToken();
    if (!pushToken) {
      return null;
    }

    const [authToken, deviceId] = await Promise.all([
      authUser.getIdToken(),
      getOrCreateDeviceId(),
    ]);

    await registerPushToken(authToken, {
      token: pushToken,
      platform: Platform.OS === 'android' ? 'android' : 'ios',
      appVersion: Constants.expoConfig?.version ?? '1.0.0',
      deviceId,
    });

    return {
      authToken,
      pushToken,
    };
  } catch (error) {
    console.warn('[PushTokenProvider] Error al registrar push token:', error);
    return null;
  }
}

async function unregisterPushToken(params: { authToken: string; pushToken: string }) {
  const { authToken, pushToken } = params;

  try {
    await deletePushToken(authToken, pushToken);
  } catch (error) {
    console.warn('[PushTokenProvider] Error al desregistrar push token:', error);
  }
}
