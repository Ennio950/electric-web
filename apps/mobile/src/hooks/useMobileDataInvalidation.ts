import { useQueryClient } from '@tanstack/react-query';

import {
  invalidateBootstrapQueries,
  invalidateBossAdminQueries,
  invalidateBossPaymentQueries,
  invalidateBossQueueQueries,
  invalidateBossSettingsQueries,
  invalidateClientEmergencyQueries,
  invalidateClientRequestQueries,
  invalidateEmployeeEmergencyChatQueries,
  invalidateEmployeeEmergencyQueries,
  invalidateEmployeeProfileQueries,
  invalidateEmployeeRequestChatQueries,
  invalidateEmployeeRequestQueries,
  invalidateMobileHomeQueries,
} from '@/src/services/apiService';
import type { ReviewQueueSourceType } from '@/src/types/api';

export function useMobileDataInvalidation() {
  const queryClient = useQueryClient();

  return {
    invalidateBootstrap: () => invalidateBootstrapQueries(queryClient),
    invalidateMobileHome: () => invalidateMobileHomeQueries(queryClient),
    invalidateClientRequest: (requestId?: string | null) =>
      invalidateClientRequestQueries(queryClient, requestId),
    invalidateClientEmergency: (callId?: string | null) =>
      invalidateClientEmergencyQueries(queryClient, callId),
    invalidateEmployeeRequest: (requestId?: string | null) =>
      invalidateEmployeeRequestQueries(queryClient, requestId),
    invalidateEmployeeRequestChat: (requestId: string) =>
      invalidateEmployeeRequestChatQueries(queryClient, requestId),
    invalidateEmployeeEmergency: (callId?: string | null) =>
      invalidateEmployeeEmergencyQueries(queryClient, callId),
    invalidateEmployeeEmergencyChat: (callId: string) =>
      invalidateEmployeeEmergencyChatQueries(queryClient, callId),
    invalidateEmployeeProfile: (employeeId?: string | null) =>
      invalidateEmployeeProfileQueries(queryClient, employeeId),
    invalidateBossAdmin: () => invalidateBossAdminQueries(queryClient),
    invalidateBossSettings: () => invalidateBossSettingsQueries(queryClient),
    invalidateBossQueue: (sourceType?: ReviewQueueSourceType, recordId?: string | null) =>
      invalidateBossQueueQueries(queryClient, sourceType, recordId),
    invalidateBossPayment: (sourceType: ReviewQueueSourceType, recordId: string) =>
      invalidateBossPaymentQueries(queryClient, sourceType, recordId),
  };
}
