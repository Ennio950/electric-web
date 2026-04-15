import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { onIdTokenChanged, signOut } from 'firebase/auth';

import { auth } from '@/src/config/firebase';
import { ApiError } from '@/src/lib/api';
import { loadBootstrapForUser } from '@/src/services/apiService';
import { useSessionAuthFlow, useSessionStore } from '@/src/stores/sessionStore';

export function SessionBootstrap() {
  const queryClient = useQueryClient();
  const beginBoot = useSessionStore((state) => state.beginBoot);
  const beginBootstrap = useSessionStore((state) => state.beginBootstrap);
  const finishBootstrap = useSessionStore((state) => state.finishBootstrap);
  const finishSignedOut = useSessionStore((state) => state.finishSignedOut);
  const failBootstrap = useSessionStore((state) => state.failBootstrap);
  const authFlow = useSessionAuthFlow();
  const authFlowRef = useRef(authFlow);
  const lastAuthUidRef = useRef<string | null>(null);

  useEffect(() => {
    authFlowRef.current = authFlow;
  }, [authFlow]);

  useEffect(() => {
    beginBoot();
    let cancelled = false;
    let receivedInitialAuthState = false;
    const bootFallbackTimer =
      Platform.OS === 'web'
        ? setTimeout(() => {
            if (!cancelled && !receivedInitialAuthState) {
              finishSignedOut(null);
            }
          }, 4_000)
        : null;

    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      receivedInitialAuthState = true;
      if (bootFallbackTimer) {
        clearTimeout(bootFallbackTimer);
      }

      if (cancelled) {
        return;
      }

      const nextUid = user?.uid ?? null;
      if (lastAuthUidRef.current !== nextUid) {
        lastAuthUidRef.current = nextUid;
        await queryClient.cancelQueries();
        queryClient.removeQueries();
      }

      if (!user) {
        finishSignedOut(null);
        return;
      }

      beginBootstrap(user);

      try {
        const bootstrap = await loadBootstrapForUser(user);
        if (cancelled) {
          return;
        }
        finishBootstrap(user, bootstrap);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : 'No se pudo cargar bootstrap.';

        if (error instanceof ApiError && error.status === 403 && authFlowRef.current !== 'idle') {
          failBootstrap(user, null);
          return;
        }

        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await signOut(auth).catch(() => undefined);
          finishSignedOut(message);
          return;
        }

        failBootstrap(user, message);
      }
    });

    return () => {
      cancelled = true;
      if (bootFallbackTimer) {
        clearTimeout(bootFallbackTimer);
      }
      unsubscribe();
    };
  }, [beginBoot, beginBootstrap, failBootstrap, finishBootstrap, finishSignedOut, queryClient]);

  return null;
}
