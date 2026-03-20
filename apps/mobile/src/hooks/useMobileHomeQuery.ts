import { useQuery } from '@tanstack/react-query';

import { getMobileHomeQueryOptions } from '@/src/services/apiService';
import { useIsSessionAuthenticated, useSessionRole } from '@/src/stores/sessionStore';

export function useMobileHomeQuery() {
  const role = useSessionRole();
  const isAuthenticated = useIsSessionAuthenticated();

  return useQuery(getMobileHomeQueryOptions({ role, enabled: isAuthenticated }));
}
