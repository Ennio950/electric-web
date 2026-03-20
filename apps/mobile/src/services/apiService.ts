import type { User } from 'firebase/auth';
import { queryOptions } from '@tanstack/react-query';

import {
  fetchBootstrap,
  fetchBossRequests,
  fetchBossReviewQueue,
  fetchClientRequests,
  fetchEmergencyCalls,
  fetchEmployeeRequests,
  fetchMobileHome,
  withCurrentToken,
} from '@/src/lib/api';
import { MOBILE_QUERY_STALE_TIME } from '@/src/lib/queryClient';
import type { MobileUserRole } from '@/src/types/api';

export const mobileQueryKeys = {
  home: (role: MobileUserRole | null) => ['mobile-home', role ?? 'guest'] as const,
  clientRequests: () => ['client-requests'] as const,
  clientEmergencyCalls: () => ['client-emergency-calls'] as const,
  employeeRequests: () => ['employee-requests'] as const,
  employeeHomeRequests: () => ['employee-home-requests'] as const,
  employeeEmergencyCalls: () => ['employee-emergency-calls'] as const,
  employeeHomeEmergencyCalls: () => ['employee-home-emergencies'] as const,
  bossRequests: () => ['boss-requests'] as const,
  bossHomeRequests: () => ['boss-home-requests'] as const,
  bossReviewQueue: () => ['boss-review-queue'] as const,
  bossHomeReviewQueue: () => ['boss-home-review-queue'] as const,
  bossEmergencyCalls: () => ['boss-emergency-calls'] as const,
  bossHomeEmergencyCalls: () => ['boss-home-emergencies'] as const,
};

export function loadBootstrapForUser(user: Pick<User, 'getIdToken'>) {
  return user.getIdToken().then((token) => fetchBootstrap(token));
}

export function loadMobileHome() {
  return withCurrentToken(fetchMobileHome);
}

export function loadClientRequests() {
  return withCurrentToken(fetchClientRequests);
}

export function loadClientEmergencyCalls() {
  return withCurrentToken((token) => fetchEmergencyCalls(token, { mode: 'all' }));
}

export function loadEmployeeRequests() {
  return withCurrentToken(fetchEmployeeRequests);
}

export function loadEmployeeEmergencyCalls() {
  return withCurrentToken((token) => fetchEmergencyCalls(token));
}

export function loadBossRequests() {
  return withCurrentToken(fetchBossRequests);
}

export function loadBossReviewQueue() {
  return withCurrentToken(fetchBossReviewQueue);
}

export function loadBossEmergencyCalls() {
  return withCurrentToken((token) => fetchEmergencyCalls(token, { mode: 'all' }));
}

export function getMobileHomeQueryOptions(params: { role: MobileUserRole | null; enabled?: boolean }) {
  const { role, enabled = true } = params;

  return queryOptions({
    queryKey: mobileQueryKeys.home(role),
    enabled: enabled && Boolean(role),
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: loadMobileHome,
  });
}

export function getClientRequestsQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.clientRequests(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: loadClientRequests,
  });
}

export function getClientEmergencyCallsQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.clientEmergencyCalls(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: loadClientEmergencyCalls,
  });
}

export function getEmployeeRequestsQueryOptions(enabled = true, key: 'queue' | 'home' = 'queue') {
  return queryOptions({
    queryKey: key === 'home' ? mobileQueryKeys.employeeHomeRequests() : mobileQueryKeys.employeeRequests(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: loadEmployeeRequests,
  });
}

export function getEmployeeEmergencyCallsQueryOptions(enabled = true, key: 'queue' | 'home' = 'queue') {
  return queryOptions({
    queryKey: key === 'home' ? mobileQueryKeys.employeeHomeEmergencyCalls() : mobileQueryKeys.employeeEmergencyCalls(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: loadEmployeeEmergencyCalls,
  });
}

export function getBossRequestsQueryOptions(enabled = true, key: 'queue' | 'home' = 'queue') {
  return queryOptions({
    queryKey: key === 'home' ? mobileQueryKeys.bossHomeRequests() : mobileQueryKeys.bossRequests(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: loadBossRequests,
  });
}

export function getBossReviewQueueQueryOptions(enabled = true, key: 'queue' | 'home' = 'queue') {
  return queryOptions({
    queryKey: key === 'home' ? mobileQueryKeys.bossHomeReviewQueue() : mobileQueryKeys.bossReviewQueue(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: loadBossReviewQueue,
  });
}

export function getBossEmergencyCallsQueryOptions(enabled = true, key: 'queue' | 'home' = 'queue') {
  return queryOptions({
    queryKey: key === 'home' ? mobileQueryKeys.bossHomeEmergencyCalls() : mobileQueryKeys.bossEmergencyCalls(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: loadBossEmergencyCalls,
  });
}
