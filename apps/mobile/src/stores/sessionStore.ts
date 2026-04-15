import { User } from 'firebase/auth';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import type { AppRouteHref } from '@/src/navigation/routes';
import type { MobileBootstrapResponse, MobileUserRole } from '@/src/types/api';

export type AuthFlowMode =
  | 'idle'
  | 'employee-application'
  | 'client-signup'
  | 'client-magic'
  | 'client-google';

export type SessionSnapshot = {
  isLoading: boolean;
  isAuthenticated: boolean;
  role: MobileUserRole | null;
  notice: string | null;
  userId: string | null;
};

export type SessionStore = {
  authUser: User | null;
  bootstrap: MobileBootstrapResponse | null;
  isBooting: boolean;
  notice: string | null;
  pendingHref: AppRouteHref | null;
  authFlow: AuthFlowMode;
  beginBoot: () => void;
  beginBootstrap: (user: User) => void;
  finishBootstrap: (user: User, bootstrap: MobileBootstrapResponse) => void;
  finishSignedOut: (notice: string | null) => void;
  failBootstrap: (user: User, notice: string | null) => void;
  setNotice: (notice: string | null) => void;
  setPendingHref: (href: AppRouteHref | null) => void;
  consumePendingHref: () => AppRouteHref | null;
  setAuthFlow: (authFlow: AuthFlowMode) => void;
};

function hasSameBootstrapUser(bootstrap: MobileBootstrapResponse | null, user: User) {
  return bootstrap?.user.uid === user.uid;
}

export const sessionSelectors = {
  authFlow: (state: SessionStore) => state.authFlow,
  authUser: (state: SessionStore) => state.authUser,
  bootstrap: (state: SessionStore) => state.bootstrap,
  companyConfig: (state: SessionStore) => state.bootstrap?.companyConfig ?? null,
  featureFlags: (state: SessionStore) => state.bootstrap?.featureFlags ?? null,
  isAuthenticated: (state: SessionStore) => Boolean(state.bootstrap),
  isBooting: (state: SessionStore) => state.isBooting,
  notice: (state: SessionStore) => state.notice,
  pendingHref: (state: SessionStore) => state.pendingHref,
  role: (state: SessionStore) => state.bootstrap?.role ?? null,
};

const useSessionStoreBase = create<SessionStore>((set, get) => ({
  authUser: null,
  bootstrap: null,
  isBooting: true,
  notice: null,
  pendingHref: null,
  authFlow: 'idle',
  beginBoot: () => {
    set({ isBooting: true });
  },
  beginBootstrap: (user) => {
    set((state) => {
      const preserveBootstrap = hasSameBootstrapUser(state.bootstrap, user);
      return {
        authUser: user,
        bootstrap: preserveBootstrap ? state.bootstrap : null,
        isBooting: !preserveBootstrap,
        notice: null,
      };
    });
  },
  finishBootstrap: (user, bootstrap) => {
    set({
      authUser: user,
      bootstrap,
      isBooting: false,
      authFlow: 'idle',
      notice: null,
    });
  },
  finishSignedOut: (notice) => {
    set({
      authUser: null,
      bootstrap: null,
      isBooting: false,
      authFlow: 'idle',
      notice,
    });
  },
  failBootstrap: (user, notice) => {
    set((state) => {
      const preserveBootstrap = hasSameBootstrapUser(state.bootstrap, user);
      return {
        authUser: user,
        bootstrap: preserveBootstrap ? state.bootstrap : null,
        isBooting: false,
        notice,
      };
    });
  },
  setNotice: (notice) => {
    set({ notice });
  },
  setPendingHref: (href) => {
    set({ pendingHref: href });
  },
  consumePendingHref: () => {
    const current = get().pendingHref;
    set({ pendingHref: null });
    return current;
  },
  setAuthFlow: (authFlow) => {
    set({ authFlow });
  },
}));

export const useSessionStore = useSessionStoreBase;

export function useSessionAuthFlow() {
  return useSessionStoreBase(sessionSelectors.authFlow);
}

export function useSessionAuthUser() {
  return useSessionStoreBase(sessionSelectors.authUser);
}

export function useSessionBootstrap() {
  return useSessionStoreBase(sessionSelectors.bootstrap);
}

export function useSessionCompanyConfig() {
  return useSessionStoreBase(sessionSelectors.companyConfig);
}

export function useSessionFeatureFlags() {
  return useSessionStoreBase(sessionSelectors.featureFlags);
}

export function useIsSessionAuthenticated() {
  return useSessionStoreBase(sessionSelectors.isAuthenticated);
}

export function useIsSessionBooting() {
  return useSessionStoreBase(sessionSelectors.isBooting);
}

export function useSessionNotice() {
  return useSessionStoreBase(sessionSelectors.notice);
}

export function useSessionPendingHref() {
  return useSessionStoreBase(sessionSelectors.pendingHref);
}

export function useSessionRole() {
  return useSessionStoreBase(sessionSelectors.role);
}

export function useSessionSnapshot(): SessionSnapshot {
  return useSessionStoreBase(useShallow((state) => ({
    isLoading: sessionSelectors.isBooting(state),
    isAuthenticated: sessionSelectors.isAuthenticated(state),
    role: sessionSelectors.role(state),
    notice: sessionSelectors.notice(state),
    userId: state.authUser?.uid ?? null,
  })));
}
