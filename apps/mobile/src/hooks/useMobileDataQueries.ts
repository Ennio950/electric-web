import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  getBossCompanyConfigQueryOptions,
  getBossDashboardQueryOptions,
  getBossEmergencyCallsQueryOptions,
  getBossEarningsQueryOptions,
  getBossEmployeeRequestsQueryOptions,
  getBossEmployeesQueryOptions,
  getBossNotificationChannelsQueryOptions,
  getBossNotificationSettingsQueryOptions,
  getBossPaymentDetailQueryOptions,
  getBossPhotoChangeRequestsQueryOptions,
  getBossQueueDetailQueryOptions,
  getBossRequestsQueryOptions,
  getBossReviewQueueQueryOptions,
  getClientDashboardQueryOptions,
  getClientEmergencyCallsQueryOptions,
  getClientRequestsQueryOptions,
  getEmergencyChatQueryOptions,
  getEmergencyDetailQueryOptions,
  getEmployeeAvailableRequestsQueryOptions,
  getEmployeeDashboardQueryOptions,
  getEmployeeEmergencyCallsQueryOptions,
  getEmployeePublicProfileQueryOptions,
  getEmployeeRequestsQueryOptions,
  getMobileHomeQueryOptions,
  getMyEmployeePhotoChangeQueryOptions,
  getRequestChatQueryOptions,
  getRequestDetailQueryOptions,
  type MobileQueueScope,
} from '@/src/services/apiService';
import { useSessionSnapshot } from '@/src/stores/sessionStore';
import type {
  MarketplaceEmergencyCall,
  MarketplaceRequest,
  MobileUserRole,
  ReviewQueueSourceType,
} from '@/src/types/api';

function isRoleActive(actualRole: MobileUserRole | null, expectedRole: MobileUserRole) {
  return actualRole === expectedRole;
}

function useQuerySession(role?: MobileUserRole) {
  const session = useSessionSnapshot();
  const enabled = session.isAuthenticated && (!role || isRoleActive(session.role, role));

  return {
    session,
    enabled,
  };
}

export function useMobileHomeQuery() {
  const { session } = useQuerySession();

  return useQuery(getMobileHomeQueryOptions({
    role: session.role,
    enabled: session.isAuthenticated,
  }));
}

export function useMobileDashboardQuery() {
  const { session } = useQuerySession();

  // For now, dashboards redirect to home query based on role
  if (session.role === 'boss') {
    return useQuery(getBossDashboardQueryOptions(session.isAuthenticated));
  } else if (session.role === 'employee') {
    return useQuery(getEmployeeDashboardQueryOptions(session.isAuthenticated));
  } else {
    return useQuery(getClientDashboardQueryOptions(session.isAuthenticated));
  }
}

export function useClientDashboardQuery() {
  const { enabled } = useQuerySession('client');

  return useQuery(getClientDashboardQueryOptions(enabled));
}

export function useEmployeeDashboardQuery() {
  const { enabled } = useQuerySession('employee');

  return useQuery(getEmployeeDashboardQueryOptions(enabled));
}

export function useBossDashboardQuery() {
  const { enabled } = useQuerySession('boss');

  return useQuery(getBossDashboardQueryOptions(enabled));
}

export function useClientRequestsQuery() {
  const { enabled } = useQuerySession('client');

  return useQuery(getClientRequestsQueryOptions(enabled));
}

export function useClientRequestDetailQuery(requestId: string | null) {
  const { enabled } = useQuerySession('client');

  return useQuery(getRequestDetailQueryOptions(requestId ?? '', enabled && Boolean(requestId)));
}

export function useClientEmergencyCallsQuery() {
  const { enabled } = useQuerySession('client');

  return useQuery(getClientEmergencyCallsQueryOptions(enabled));
}

export function useClientEmergencyDetailQuery(callId: string | null) {
  const { enabled } = useQuerySession('client');

  return useQuery(getEmergencyDetailQueryOptions(callId ?? '', enabled && Boolean(callId)));
}

export function useEmployeeAvailableRequestsQuery() {
  const { enabled } = useQuerySession('employee');

  return useQuery(getEmployeeAvailableRequestsQueryOptions(enabled));
}

export function useEmployeeRequestsQuery(scope: MobileQueueScope = 'queue') {
  const { enabled } = useQuerySession('employee');

  return useQuery(getEmployeeRequestsQueryOptions(enabled, scope));
}

export function useEmployeeEmergencyCallsQuery(scope: MobileQueueScope = 'queue') {
  const { enabled } = useQuerySession('employee');

  return useQuery(getEmployeeEmergencyCallsQueryOptions(enabled, scope));
}

export function useRequestDetailQuery(requestId: string | null) {
  const { enabled } = useQuerySession('employee');

  return useQuery(getRequestDetailQueryOptions(requestId ?? '', enabled && Boolean(requestId)));
}

export function useRequestChatQuery(requestId: string | null) {
  const { enabled } = useQuerySession('employee');

  return useQuery(getRequestChatQueryOptions(requestId ?? '', enabled && Boolean(requestId)));
}

export function useEmergencyDetailQuery(callId: string | null) {
  const { enabled } = useQuerySession('employee');

  return useQuery(getEmergencyDetailQueryOptions(callId ?? '', enabled && Boolean(callId)));
}

export function useEmergencyChatQuery(callId: string | null) {
  const { enabled } = useQuerySession('employee');

  return useQuery(getEmergencyChatQueryOptions(callId ?? '', enabled && Boolean(callId)));
}

export function useMyEmployeePhotoChangeQuery() {
  const { enabled } = useQuerySession('employee');

  return useQuery(getMyEmployeePhotoChangeQueryOptions(enabled));
}

export function useEmployeePublicProfileQuery(employeeId?: string | null) {
  const { session, enabled } = useQuerySession('employee');
  const targetId = employeeId ?? session.userId ?? '';

  return useQuery(getEmployeePublicProfileQueryOptions(targetId, enabled && Boolean(targetId)));
}

export function useBossRequestsQuery(scope: MobileQueueScope = 'queue') {
  const { enabled } = useQuerySession('boss');

  return useQuery(getBossRequestsQueryOptions(enabled, scope));
}

export function useBossReviewQueueQuery(scope: MobileQueueScope = 'queue') {
  const { enabled } = useQuerySession('boss');

  return useQuery(getBossReviewQueueQueryOptions(enabled, scope));
}

export function useBossEmergencyCallsQuery(scope: MobileQueueScope = 'queue') {
  const { enabled } = useQuerySession('boss');

  return useQuery(getBossEmergencyCallsQueryOptions(enabled, scope));
}

export function useBossQueueDetailQuery(
  sourceType: 'request',
  recordId: string | null,
): UseQueryResult<MarketplaceRequest, Error>;
export function useBossQueueDetailQuery(
  sourceType: 'emergency',
  recordId: string | null,
): UseQueryResult<MarketplaceEmergencyCall, Error>;
export function useBossQueueDetailQuery(
  sourceType: ReviewQueueSourceType,
  recordId: string | null,
): UseQueryResult<MarketplaceRequest | MarketplaceEmergencyCall, Error>;
export function useBossQueueDetailQuery(
  sourceType: ReviewQueueSourceType,
  recordId: string | null,
): UseQueryResult<MarketplaceRequest | MarketplaceEmergencyCall, Error> {
  const { enabled } = useQuerySession('boss');

  return useQuery(getBossQueueDetailQueryOptions(sourceType, recordId ?? '', enabled && Boolean(recordId))) as any;
}

export function useBossPaymentDetailQuery(
  sourceType: 'request',
  recordId: string | null,
): UseQueryResult<MarketplaceRequest, Error>;
export function useBossPaymentDetailQuery(
  sourceType: 'emergency',
  recordId: string | null,
): UseQueryResult<MarketplaceEmergencyCall, Error>;
export function useBossPaymentDetailQuery(
  sourceType: ReviewQueueSourceType,
  recordId: string | null,
): UseQueryResult<MarketplaceRequest | MarketplaceEmergencyCall, Error>;
export function useBossPaymentDetailQuery(
  sourceType: ReviewQueueSourceType,
  recordId: string | null,
): UseQueryResult<MarketplaceRequest | MarketplaceEmergencyCall, Error> {
  const { enabled } = useQuerySession('boss');

  return useQuery(getBossPaymentDetailQueryOptions(sourceType, recordId ?? '', enabled && Boolean(recordId))) as any;
}

export function useBossEmployeesQuery() {
  const { enabled } = useQuerySession('boss');

  return useQuery(getBossEmployeesQueryOptions(enabled));
}

export function useBossEarningsQuery() {
  const { enabled } = useQuerySession('boss');

  return useQuery(getBossEarningsQueryOptions(enabled));
}

export function useBossEmployeeRequestsQuery() {
  const { enabled } = useQuerySession('boss');

  return useQuery(getBossEmployeeRequestsQueryOptions(enabled));
}

export function useBossPhotoChangeRequestsQuery() {
  const { enabled } = useQuerySession('boss');

  return useQuery(getBossPhotoChangeRequestsQueryOptions(enabled));
}

export function useBossCompanyConfigQuery() {
  const { enabled } = useQuerySession('boss');

  return useQuery(getBossCompanyConfigQueryOptions(enabled));
}

export function useBossNotificationChannelsQuery() {
  const { enabled } = useQuerySession('boss');

  return useQuery(getBossNotificationChannelsQueryOptions(enabled));
}

export function useBossNotificationSettingsQuery() {
  const { enabled } = useQuerySession('boss');

  return useQuery(getBossNotificationSettingsQueryOptions(enabled));
}
