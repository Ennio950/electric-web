import NetInfo from '@react-native-community/netinfo';
import { onlineManager, QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/src/lib/apiClient';

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(Boolean(state.isConnected));
  });
});

export const MOBILE_QUERY_STALE_TIME = 30_000;
export const MOBILE_QUERY_GC_TIME = 5 * 60_000;

function shouldRetryQuery(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }

  return failureCount < 1;
}

export function createMobileQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        staleTime: MOBILE_QUERY_STALE_TIME,
        gcTime: MOBILE_QUERY_GC_TIME,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
