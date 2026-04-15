import Constants from 'expo-constants';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { resolveNotificationHref } from '@/src/lib/notificationRouting';
import { appRoutes, pushAppRoute, replaceAppRoute } from '@/src/navigation/routes';
import {
  useIsSessionBooting,
  useSessionBootstrap,
  useSessionPendingHref,
  useSessionStore,
} from '@/src/stores/sessionStore';

type NotificationsModule = typeof import('expo-notifications');
type NotificationResponse = import('expo-notifications').NotificationResponse;

function isExpoGo() {
  return Constants.executionEnvironment === 'storeClient';
}

async function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web' || isExpoGo()) {
    return null;
  }

  try {
    return await import('expo-notifications');
  } catch (error) {
    console.warn('[NotificationRouterProvider] No se pudo cargar expo-notifications:', error);
    return null;
  }
}

export function NotificationRouterProvider() {
  const isBooting = useIsSessionBooting();
  const bootstrap = useSessionBootstrap();
  const pendingHref = useSessionPendingHref();
  const setPendingHref = useSessionStore((state) => state.setPendingHref);
  const consumePendingHref = useSessionStore((state) => state.consumePendingHref);
  const lastHandledIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isBooting || !bootstrap || !pendingHref) {
      return;
    }

    const href = consumePendingHref();
    if (!href) {
      return;
    }

    pushAppRoute(href);
  }, [bootstrap, consumePendingHref, isBooting, pendingHref]);

  useEffect(() => {
    let isMounted = true;
    let responseSubscription: { remove: () => void } | null = null;

    const handleResponse = (response: NotificationResponse) => {
      const identifier = response.notification.request.identifier;
      if (lastHandledIdRef.current === identifier) {
        return;
      }

      lastHandledIdRef.current = identifier;

      const href = resolveNotificationHref(response.notification.request.content.data ?? null, bootstrap?.role ?? null);
      if (!href) {
        return;
      }

      if (bootstrap) {
        pushAppRoute(href);
        return;
      }

      setPendingHref(href);
      if (!isBooting) {
        replaceAppRoute(appRoutes.authLogin);
      }
    };

    async function wireNotifications() {
      const Notifications = await loadNotificationsModule();
      if (!Notifications || !isMounted) {
        return;
      }

      const lastResponse = await Notifications.getLastNotificationResponseAsync().catch(() => null);
      if (lastResponse && isMounted) {
        handleResponse(lastResponse);
      }

      responseSubscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    }

    void wireNotifications();

    return () => {
      isMounted = false;
      responseSubscription?.remove();
    };
  }, [bootstrap, isBooting, setPendingHref]);

  return null;
}
