import type { User } from 'firebase/auth';
import { queryOptions, type QueryClient } from '@tanstack/react-query';

import {
  fetchBootstrap,
  fetchBossRequests,
  fetchBossEmployees,
  fetchBossReviewQueue,
  fetchBossEmployeeRequests,
  fetchBossPhotoChangeRequests,
  fetchBossEarnings,
  fetchBossCompanyConfig,
  fetchBossNotificationChannels,
  fetchBossNotificationSettings,
  fetchClientRequests,
  fetchEmergencyCalls,
  fetchEmergencyDetail,
  fetchEmergencyChat,
  fetchEmployeeRequests,
  fetchEmployeeActiveJob,
  fetchAvailableRequests,
  fetchRequestDetail,
  fetchRequestChat,
  fetchMyEmployeePhotoChange,
  fetchEmployeePublicProfile,
  fetchBuilderEstimates,
  fetchCatalogMaterials,
  fetchCatalogRecipes,
  fetchInvoices,
  fetchMobileHome,
  withCurrentToken,
} from '@/src/lib/api';
import { MOBILE_QUERY_STALE_TIME } from '@/src/lib/queryClient';
import type { MobileUserRole, ReviewQueueSourceType, MarketplaceRequest, MarketplaceEmergencyCall } from '@/src/types/api';

export type MobileQueueScope = 'home' | 'queue';
const MOBILE_CLIENT_POLL_INTERVAL = 15_000;
const MOBILE_CHAT_POLL_INTERVAL = 8_000;

export const mobileQueryKeys = {
  bootstrap: () => ['mobile-bootstrap'] as const,
  home: (role: MobileUserRole | null) => ['mobile-home', role ?? 'guest'] as const,
  
  clientRequests: () => ['client-requests'] as const,
  clientRequestDetail: (requestId: string) => ['client-request', requestId] as const,
  clientEmergencyCalls: () => ['client-emergency-calls'] as const,
  clientEmergencyDetail: (callId: string) => ['client-emergency', callId] as const,
  clientDashboard: () => ['client-dashboard'] as const,

  employeeRequests: () => ['employee-requests'] as const,
  employeeHomeRequests: () => ['employee-home-requests'] as const,
  employeeAvailableRequests: () => ['employee-available-requests'] as const,
  employeeActiveJob: () => ['employee-active-job'] as const,
  employeeEmergencyCalls: () => ['employee-emergency-calls'] as const,
  employeeHomeEmergencyCalls: () => ['employee-home-emergencies'] as const,
  employeeProfile: (employeeId: string) => ['employee-profile', employeeId] as const,
  employeeDashboard: () => ['employee-dashboard'] as const,
  myEmployeePhotoChange: () => ['my-employee-photo-change'] as const,

  requestDetail: (requestId: string) => ['request-detail', requestId] as const,
  requestChat: (requestId: string) => ['request-chat', requestId] as const,
  emergencyDetail: (callId: string) => ['emergency-detail', callId] as const,
  emergencyChat: (callId: string) => ['emergency-chat', callId] as const,

  bossRequests: () => ['boss-requests'] as const,
  bossHomeRequests: () => ['boss-home-requests'] as const,
  bossEmployees: () => ['boss-employees'] as const,
  bossEmployeeRequests: () => ['boss-employee-requests'] as const,
  bossReviewQueue: () => ['boss-review-queue'] as const,
  bossHomeReviewQueue: () => ['boss-home-review-queue'] as const,
  bossEmergencyCalls: () => ['boss-emergency-calls'] as const,
  bossHomeEmergencyCalls: () => ['boss-home-emergencies'] as const,
  bossEarnings: () => ['boss-earnings'] as const,
  bossDashboard: () => ['boss-dashboard'] as const,
  bossCompanyConfig: () => ['boss-company-config'] as const,
  bossNotificationChannels: () => ['boss-notification-channels'] as const,
  bossNotificationSettings: () => ['boss-notification-settings'] as const,
  bossPhotoChangeRequests: () => ['boss-photo-change-requests'] as const,
  bossQueueDetail: (type: string, id: string) => ['boss-queue-detail', type, id] as const,
  bossPaymentDetail: (type: string, id: string) => ['boss-payment-detail', type, id] as const,

  builderEstimates: () => ['builder-estimates'] as const,
  catalogMaterials: () => ['catalog-materials'] as const,
  catalogRecipes: () => ['catalog-recipes'] as const,
  invoices: () => ['invoices'] as const,
};

// ============================================================
// Loaders
// ============================================================

export function loadBootstrapForUser(user: Pick<User, 'getIdToken'>) {
  return user.getIdToken().then((token) => fetchBootstrap(token));
}

export function loadMobileHome() {
  return withCurrentToken((token) => fetchMobileHome(token));
}

// ============================================================
// Query Options
// ============================================================

export function getMobileHomeQueryOptions(params: { role: MobileUserRole | null; enabled?: boolean }) {
  const { role, enabled = true } = params;
  return queryOptions({
    queryKey: mobileQueryKeys.home(role),
    enabled: enabled && Boolean(role),
    staleTime: MOBILE_QUERY_STALE_TIME,
    refetchInterval: enabled && Boolean(role) ? MOBILE_CLIENT_POLL_INTERVAL : false,
    refetchIntervalInBackground: false,
    queryFn: loadMobileHome,
  });
}

export function getClientRequestsQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.clientRequests(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    refetchInterval: enabled ? MOBILE_CLIENT_POLL_INTERVAL : false,
    refetchIntervalInBackground: false,
    queryFn: () => withCurrentToken(fetchClientRequests),
  });
}

export function getClientEmergencyCallsQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.clientEmergencyCalls(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    refetchInterval: enabled ? MOBILE_CLIENT_POLL_INTERVAL : false,
    refetchIntervalInBackground: false,
    queryFn: () => withCurrentToken((token) => fetchEmergencyCalls(token, { mode: 'all' })),
  });
}

export function getEmployeeRequestsQueryOptions(enabled = true, key: MobileQueueScope = 'queue') {
  return queryOptions({
    queryKey: key === 'home' ? mobileQueryKeys.employeeHomeRequests() : mobileQueryKeys.employeeRequests(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: () => withCurrentToken(fetchEmployeeRequests),
  });
}

export function getEmployeeAvailableRequestsQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.employeeAvailableRequests(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: () => withCurrentToken(fetchAvailableRequests),
  });
}

export function getEmployeeEmergencyCallsQueryOptions(enabled = true, key: MobileQueueScope = 'queue') {
  return queryOptions({
    queryKey: key === 'home' ? mobileQueryKeys.employeeHomeEmergencyCalls() : mobileQueryKeys.employeeEmergencyCalls(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: () => withCurrentToken((token) => fetchEmergencyCalls(token)),
  });
}

export function getBossRequestsQueryOptions(enabled = true, key: MobileQueueScope = 'queue') {
  return queryOptions({
    queryKey: key === 'home' ? mobileQueryKeys.bossHomeRequests() : mobileQueryKeys.bossRequests(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: () => withCurrentToken(fetchBossRequests),
  });
}

export function getBossReviewQueueQueryOptions(enabled = true, key: MobileQueueScope = 'queue') {
  return queryOptions({
    queryKey: key === 'home' ? mobileQueryKeys.bossHomeReviewQueue() : mobileQueryKeys.bossReviewQueue(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: () => withCurrentToken(fetchBossReviewQueue),
  });
}

export function getBossEmergencyCallsQueryOptions(enabled = true, key: MobileQueueScope = 'queue') {
  return queryOptions({
    queryKey: key === 'home' ? mobileQueryKeys.bossHomeEmergencyCalls() : mobileQueryKeys.bossEmergencyCalls(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: () => withCurrentToken((token) => fetchEmergencyCalls(token, { mode: 'all' })),
  });
}

export function getBossEmployeesQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.bossEmployees(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: () => withCurrentToken(fetchBossEmployees),
  });
}

export function getBossEmployeeRequestsQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.bossEmployeeRequests(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: () => withCurrentToken(fetchBossEmployeeRequests),
  });
}

export function getBossEarningsQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.bossEarnings(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: () => withCurrentToken(fetchBossEarnings),
  });
}

export function getBossCompanyConfigQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.bossCompanyConfig(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: () => withCurrentToken(fetchBossCompanyConfig),
  });
}

export function getBossNotificationChannelsQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.bossNotificationChannels(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: () => withCurrentToken(fetchBossNotificationChannels),
  });
}

export function getBossNotificationSettingsQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.bossNotificationSettings(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: () => withCurrentToken(fetchBossNotificationSettings),
  });
}

export function getBossPhotoChangeRequestsQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.bossPhotoChangeRequests(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: () => withCurrentToken(fetchBossPhotoChangeRequests),
  });
}

export function getEmployeePublicProfileQueryOptions(employeeId: string, enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.employeeProfile(employeeId),
    enabled: enabled && Boolean(employeeId),
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: () => withCurrentToken((token) => fetchEmployeePublicProfile(token, employeeId)),
  });
}

export function getMyEmployeePhotoChangeQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.myEmployeePhotoChange(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: () => withCurrentToken(fetchMyEmployeePhotoChange),
  });
}

export function getRequestDetailQueryOptions(requestId: string, enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.requestDetail(requestId),
    enabled: enabled && Boolean(requestId),
    staleTime: MOBILE_QUERY_STALE_TIME,
    refetchInterval: enabled && Boolean(requestId) ? MOBILE_CLIENT_POLL_INTERVAL : false,
    refetchIntervalInBackground: false,
    queryFn: () => withCurrentToken((token) => fetchRequestDetail(token, requestId)),
  });
}

export function getRequestChatQueryOptions(requestId: string, enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.requestChat(requestId),
    enabled: enabled && Boolean(requestId),
    staleTime: 0,
    refetchInterval: enabled && Boolean(requestId) ? MOBILE_CHAT_POLL_INTERVAL : false,
    refetchIntervalInBackground: false,
    queryFn: () => withCurrentToken((token) => fetchRequestChat(token, requestId)),
  });
}

export function getEmergencyDetailQueryOptions(callId: string, enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.emergencyDetail(callId),
    enabled: enabled && Boolean(callId),
    staleTime: MOBILE_QUERY_STALE_TIME,
    refetchInterval: enabled && Boolean(callId) ? MOBILE_CLIENT_POLL_INTERVAL : false,
    refetchIntervalInBackground: false,
    queryFn: () => withCurrentToken((token) => fetchEmergencyDetail(token, callId)),
  });
}

export function getEmergencyChatQueryOptions(callId: string, enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.emergencyChat(callId),
    enabled: enabled && Boolean(callId),
    staleTime: 0,
    refetchInterval: enabled && Boolean(callId) ? MOBILE_CHAT_POLL_INTERVAL : false,
    refetchIntervalInBackground: false,
    queryFn: () => withCurrentToken((token) => fetchEmergencyChat(token, callId)),
  });
}

export function getBossQueueDetailQueryOptions(type: ReviewQueueSourceType, id: string, enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.bossQueueDetail(type, id),
    enabled: enabled && Boolean(id),
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: () => withCurrentToken((token) => 
      (type === 'emergency' ? fetchEmergencyDetail(token, id) : fetchRequestDetail(token, id)) as Promise<MarketplaceRequest>
    ),
  });
}

export function getBossPaymentDetailQueryOptions(type: ReviewQueueSourceType, id: string, enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.bossPaymentDetail(type, id),
    enabled: enabled && Boolean(id),
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: () => withCurrentToken((token) => 
      (type === 'emergency' ? fetchEmergencyDetail(token, id) : fetchRequestDetail(token, id)) as Promise<MarketplaceRequest>
    ),
  });
}

// Placeholder for dashboards if they exist as separate endpoints
export function getBossDashboardQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.bossDashboard(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: loadMobileHome,
  });
}

export function getEmployeeDashboardQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.employeeDashboard(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: loadMobileHome,
  });
}

export function getClientDashboardQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: mobileQueryKeys.clientDashboard(),
    enabled,
    staleTime: MOBILE_QUERY_STALE_TIME,
    queryFn: loadMobileHome,
  });
}

// Invalidators
export function invalidateBootstrapQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: mobileQueryKeys.bootstrap() });
}

export function invalidateMobileHomeQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['mobile-home'] });
}

export function invalidateClientRequestQueries(qc: QueryClient, id?: string | null) {
  qc.invalidateQueries({ queryKey: id ? mobileQueryKeys.clientRequestDetail(id) : mobileQueryKeys.clientRequests() });
  qc.invalidateQueries({ queryKey: ['client-dashboard'] });
}

export function invalidateClientEmergencyQueries(qc: QueryClient, id?: string | null) {
  qc.invalidateQueries({ queryKey: id ? mobileQueryKeys.clientEmergencyDetail(id) : mobileQueryKeys.clientEmergencyCalls() });
  qc.invalidateQueries({ queryKey: ['client-dashboard'] });
}

export function invalidateEmployeeRequestQueries(qc: QueryClient, id?: string | null) {
  qc.invalidateQueries({ queryKey: mobileQueryKeys.employeeRequests() });
  qc.invalidateQueries({ queryKey: mobileQueryKeys.employeeHomeRequests() });
  if (id) qc.invalidateQueries({ queryKey: mobileQueryKeys.requestDetail(id) });
}

export function invalidateEmployeeRequestChatQueries(qc: QueryClient, id: string) {
  qc.invalidateQueries({ queryKey: mobileQueryKeys.requestChat(id) });
}

export function invalidateEmployeeEmergencyQueries(qc: QueryClient, id?: string | null) {
  qc.invalidateQueries({ queryKey: mobileQueryKeys.employeeEmergencyCalls() });
  qc.invalidateQueries({ queryKey: mobileQueryKeys.employeeHomeEmergencyCalls() });
  if (id) qc.invalidateQueries({ queryKey: mobileQueryKeys.emergencyDetail(id) });
}

export function invalidateEmployeeEmergencyChatQueries(qc: QueryClient, id: string) {
  qc.invalidateQueries({ queryKey: mobileQueryKeys.emergencyChat(id) });
}

export function invalidateEmployeeProfileQueries(qc: QueryClient, id?: string | null) {
  qc.invalidateQueries({ queryKey: id ? mobileQueryKeys.employeeProfile(id) : ['employee-profile'] });
}

export function invalidateBossAdminQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: mobileQueryKeys.bossEmployees() });
  qc.invalidateQueries({ queryKey: mobileQueryKeys.bossEmployeeRequests() });
}

export function invalidateBossSettingsQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: mobileQueryKeys.bossCompanyConfig() });
  qc.invalidateQueries({ queryKey: mobileQueryKeys.bossNotificationSettings() });
}

export function invalidateBossQueueQueries(qc: QueryClient, type?: ReviewQueueSourceType, id?: string | null) {
  qc.invalidateQueries({ queryKey: mobileQueryKeys.bossReviewQueue() });
  qc.invalidateQueries({ queryKey: mobileQueryKeys.bossHomeReviewQueue() });
  if (id && type) qc.invalidateQueries({ queryKey: mobileQueryKeys.bossQueueDetail(type, id) });
}

export function invalidateBossPaymentQueries(qc: QueryClient, type: ReviewQueueSourceType, id: string) {
  qc.invalidateQueries({ queryKey: mobileQueryKeys.bossEarnings() });
  if (id && type) qc.invalidateQueries({ queryKey: mobileQueryKeys.bossPaymentDetail(type, id) });
}
