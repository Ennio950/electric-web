import {
  type JsonValue,
  requestEnvelopeData,
  requestJson,
  requestPublicJson,
  requestSuccessEnvelopeData,
} from '@/src/lib/apiClient';
import type {
  BossCompanyConfig,
  BossEarningsPayload,
  BossReviewQueueItem,
  BossEmployeeRequest,
  BossNotificationSettings,
  BossNotificationChannelsPayload,
  BossPhotoChangeRequest,
  ChatMessage,
  EmployeeDirectoryItem,
  EmployeePhotoChangeRequest,
  EmployeePublicProfile,
  MarketplaceEmergencyCall,
  MarketplaceRequest,
  MobileBootstrapResponse,
  MobileHomeResponse,
  RegisterPushTokenRequest,
} from '@/src/types/api';

export { ApiError, withCurrentToken } from '@/src/lib/apiClient';

type EmergencyCallFilters = {
  status?: string;
  mode?: string;
};

export function fetchBootstrap(token: string) {
  return requestJson<MobileBootstrapResponse>('/api/mobile/bootstrap', token);
}

export function ensureCurrentUserProfile(
  token: string,
  payload: {
    displayName?: string | null;
  } = {},
) {
  return requestJson<{
    ok: true;
    uid: string;
    email: string | null;
    role: string;
    created: boolean;
  }>('/auth/ensure-user', token, {
    method: 'POST',
    body: payload as unknown as JsonValue,
  });
}

export function startMagicClientAuth(email: string) {
  return requestPublicJson<{
    challengeId: string;
    delivery: 'email' | string;
  }>('/auth/magic/start', {
    method: 'POST',
    body: { email },
  });
}

export function verifyMagicClientAuth(email: string, challengeId: string, code: string) {
  return requestPublicJson<{
    token: string;
    customToken: string;
    role: 'client';
    user: { id: string; email: string | null };
  }>('/auth/magic/verify', {
    method: 'POST',
    body: { email, challengeId, code },
  });
}

export function fetchMobileHome(token: string) {
  return requestJson<MobileHomeResponse>('/api/mobile/home', token);
}

export function fetchClientRequests(token: string) {
  return requestEnvelopeData<MarketplaceRequest[]>('/api/marketplace/requests', token);
}

export function registerPushToken(token: string, payload: RegisterPushTokenRequest) {
  return requestEnvelopeData<{ tokenId: string; platform: string; deviceId: string; appVersion: string | null }>(
    '/api/mobile/push-tokens',
    token,
    {
      method: 'POST',
      body: payload as unknown as JsonValue,
    },
  );
}

export function deletePushToken(token: string, pushToken: string) {
  return requestEnvelopeData<{ ok: boolean; deleted: boolean; tokenId: string }>(
    `/api/mobile/push-tokens/${encodeURIComponent(pushToken)}`,
    token,
    {
      method: 'DELETE',
    },
  );
}

export function fetchAvailableRequests(token: string) {
  return requestEnvelopeData<MarketplaceRequest[]>('/api/marketplace/requests/available', token);
}

export function fetchEmployeeRequests(token: string) {
  return requestEnvelopeData<MarketplaceRequest[]>('/api/marketplace/employee/my-requests', token);
}

export function fetchRequestDetail(token: string, requestId: string) {
  return requestEnvelopeData<MarketplaceRequest>(`/api/marketplace/requests/${requestId}`, token);
}

export function createClientRequest(
  token: string,
  payload: {
    category?: string;
    description: string;
    address: string;
    photoUrl?: string | null;
    photoUrls?: string[];
  },
) {
  return requestEnvelopeData<MarketplaceRequest>('/api/marketplace/requests', token, {
    method: 'POST',
    body: payload as unknown as JsonValue,
  });
}

export function createClientEmergencyCall(
  token: string,
  payload: {
    clientName: string;
    phone: string;
    location: string;
    issue: string;
    priority?: string;
    dispatchMode?: 'emergency' | 'scheduled';
    scheduledDate?: string;
    scheduledTime?: string;
  },
) {
  return requestEnvelopeData<MarketplaceEmergencyCall>('/api/marketplace/emergency-calls', token, {
    method: 'POST',
    body: payload as unknown as JsonValue,
  });
}

export function cancelClientRequest(token: string, requestId: string) {
  return requestEnvelopeData<MarketplaceRequest>(`/api/marketplace/requests/${requestId}`, token, {
    method: 'DELETE',
  });
}

export function acceptRequestProposal(token: string, requestId: string) {
  return requestEnvelopeData<MarketplaceRequest>(`/api/marketplace/requests/${requestId}/accept-proposal`, token, {
    method: 'POST',
    body: {},
  });
}

export function rejectRequestProposal(token: string, requestId: string) {
  return requestEnvelopeData<MarketplaceRequest>(`/api/marketplace/requests/${requestId}/reject-proposal`, token, {
    method: 'POST',
    body: {},
  });
}

export function closeClientRequest(
  token: string,
  requestId: string,
  payload: {
    finalAmount: number;
    clientRating: number;
    finalPhotoUrl?: string | null;
  },
) {
  return requestEnvelopeData<MarketplaceRequest>(`/api/marketplace/requests/${requestId}/close`, token, {
    method: 'POST',
    body: payload as unknown as JsonValue,
  });
}

export function fetchEstimateUrl(token: string, requestId: string) {
  return requestJson<{ ok: boolean; url: string }>(`/api/marketplace/requests/${requestId}/estimate-url`, token);
}

export function submitEmployeeApplication(
  token: string,
  payload: {
    name: string;
    displayName?: string;
    phone: string;
    address: string;
    photoUrl: string;
  },
) {
  return requestJson<BossEmployeeRequest>('/employee/applications', token, {
    method: 'POST',
    body: payload as unknown as JsonValue,
  });
}

export function fetchRequestChat(token: string, requestId: string) {
  return requestEnvelopeData<ChatMessage[]>(`/api/marketplace/requests/${requestId}/chat`, token);
}

export function sendRequestChatMessage(
  token: string,
  requestId: string,
  text: string,
  attachments: string[] = [],
  options: { isInternal?: boolean } = {},
) {
  return requestEnvelopeData<ChatMessage>(`/api/marketplace/requests/${requestId}/chat`, token, {
    method: 'POST',
    body: { text, attachments, isInternal: Boolean(options.isInternal) } as unknown as JsonValue,
  });
}

export function submitRequestPaymentProof(token: string, requestId: string, proofUrl: string) {
  return requestEnvelopeData<MarketplaceRequest>(`/api/marketplace/requests/${requestId}/payment-proof`, token, {
    method: 'POST',
    body: { proofUrl },
  });
}

export function notifyBossRequestPayment(token: string, requestId: string) {
  return requestEnvelopeData<{ record: MarketplaceRequest; notification: unknown }>(
    `/api/marketplace/requests/${requestId}/notify-boss-payment`,
    token,
    {
      method: 'POST',
      body: {},
    },
  );
}

export function markRequestFinished(token: string, requestId: string) {
  return requestEnvelopeData<MarketplaceRequest>(`/api/marketplace/requests/${requestId}/finish`, token, {
    method: 'POST',
    body: {},
  });
}

export function claimRequest(token: string, requestId: string) {
  return requestEnvelopeData<MarketplaceRequest>(`/api/marketplace/requests/${requestId}/claim`, token, {
    method: 'POST',
  });
}

export function releaseRequest(token: string, requestId: string) {
  return requestEnvelopeData<MarketplaceRequest>(`/api/marketplace/requests/${requestId}/release`, token, {
    method: 'POST',
  });
}

export function fetchEmergencyCalls(token: string, filters: EmergencyCallFilters = {}) {
  return requestEnvelopeData<MarketplaceEmergencyCall[]>('/api/marketplace/emergency-calls', token, {
    query: filters,
  });
}

export function fetchEmergencyDetail(token: string, callId: string) {
  return requestEnvelopeData<MarketplaceEmergencyCall>(`/api/marketplace/emergency-calls/${callId}`, token);
}

export function closeClientEmergencyCall(
  token: string,
  callId: string,
  payload: {
    finalAmount: number;
    clientRating: number;
    finalPhotoUrl?: string | null;
  },
) {
  return requestEnvelopeData<MarketplaceEmergencyCall>(`/api/marketplace/emergency-calls/${callId}/close`, token, {
    method: 'POST',
    body: payload as unknown as JsonValue,
  });
}

export function fetchEmergencyChat(token: string, callId: string) {
  return requestEnvelopeData<ChatMessage[]>(`/api/marketplace/emergency-calls/${callId}/chat`, token);
}

export function sendEmergencyChatMessage(
  token: string,
  callId: string,
  text: string,
  attachments: string[] = [],
  options: { isInternal?: boolean } = {},
) {
  return requestEnvelopeData<ChatMessage>(`/api/marketplace/emergency-calls/${callId}/chat`, token, {
    method: 'POST',
    body: { text, attachments, isInternal: Boolean(options.isInternal) } as unknown as JsonValue,
  });
}

export function submitEmergencyPaymentProof(token: string, callId: string, proofUrl: string) {
  return requestEnvelopeData<MarketplaceEmergencyCall>(`/api/marketplace/emergency-calls/${callId}/payment-proof`, token, {
    method: 'POST',
    body: { proofUrl },
  });
}

export function notifyBossEmergencyPayment(token: string, callId: string) {
  return requestEnvelopeData<{ record: MarketplaceEmergencyCall; notification: unknown }>(
    `/api/marketplace/emergency-calls/${callId}/notify-boss-payment`,
    token,
    {
      method: 'POST',
      body: {},
    },
  );
}

export function updateEmergencyLocation(
  token: string,
  callId: string,
  payload: { lat: number; lng: number; accuracy: number | null },
) {
  return requestEnvelopeData<MarketplaceEmergencyCall>(`/api/marketplace/emergency-calls/${callId}/location`, token, {
    method: 'POST',
    body: payload as unknown as JsonValue,
  });
}

export function acceptEmergencyCall(token: string, callId: string) {
  return requestEnvelopeData<MarketplaceEmergencyCall>(`/api/marketplace/emergency-calls/${callId}/accept`, token, {
    method: 'POST',
  });
}

export function resolveEmergencyCall(token: string, callId: string, amount: number) {
  return requestEnvelopeData<MarketplaceEmergencyCall>(`/api/marketplace/emergency-calls/${callId}/resolve`, token, {
    method: 'POST',
    body: { amount },
  });
}

export function fetchBossRequests(token: string) {
  return requestEnvelopeData<MarketplaceRequest[]>('/api/marketplace/boss/requests', token);
}

export function fetchBossEmployees(token: string) {
  return requestEnvelopeData<EmployeeDirectoryItem[]>('/api/marketplace/boss/employees', token);
}

export function fetchBossReviewQueue(token: string) {
  return requestEnvelopeData<BossReviewQueueItem[]>('/api/marketplace/boss/review-queue', token);
}

export function fetchBossEmployeeRequests(token: string) {
  return requestJson<BossEmployeeRequest[]>('/boss/employee-requests', token);
}

export function approveBossEmployeeRequest(token: string, requestId: string) {
  return requestJson<BossEmployeeRequest>(`/boss/employee-requests/${requestId}/approve`, token, {
    method: 'POST',
    body: {},
  });
}

export function rejectBossEmployeeRequest(token: string, requestId: string) {
  return requestJson<BossEmployeeRequest>(`/boss/employee-requests/${requestId}/reject`, token, {
    method: 'POST',
    body: {},
  });
}

export function fetchBossPhotoChangeRequests(token: string) {
  return requestJson<BossPhotoChangeRequest[]>('/boss/photo-change-requests', token);
}

export function approveBossPhotoChangeRequest(token: string, requestId: string) {
  return requestJson<BossPhotoChangeRequest>(`/boss/photo-change-requests/${requestId}/approve`, token, {
    method: 'POST',
    body: {},
  });
}

export function rejectBossPhotoChangeRequest(token: string, requestId: string) {
  return requestJson<BossPhotoChangeRequest>(`/boss/photo-change-requests/${requestId}/reject`, token, {
    method: 'POST',
    body: {},
  });
}

export function fetchBossEarnings(token: string) {
  return requestSuccessEnvelopeData<BossEarningsPayload>('/api/marketplace/boss/earnings', token, {
    query: { history: true, limit: 20 },
  });
}

export function fetchBossCompanyConfig(token: string) {
  return requestEnvelopeData<BossCompanyConfig>('/boss/company-config', token);
}

export function updateBossCompanyConfig(
  token: string,
  payload: Partial<Pick<BossCompanyConfig, 'displayName' | 'tagline' | 'phone' | 'whatsappNumber' | 'timezone' | 'locale' | 'currency' | 'email' | 'address'>>,
) {
  return requestEnvelopeData<BossCompanyConfig>('/boss/company-config', token, {
    method: 'PUT',
    body: payload as unknown as JsonValue,
  });
}

export function fetchBossNotificationChannels(token: string) {
  return requestEnvelopeData<BossNotificationChannelsPayload>('/boss/notifications/channels', token);
}

export function fetchBossNotificationSettings(token: string) {
  return requestEnvelopeData<BossNotificationSettings>('/boss/notifications/settings', token);
}

export function updateBossNotificationSettings(
  token: string,
  payload: {
    whatsapp?: {
      alertNumber?: string;
      transport?: string;
      webhookUrl?: string;
      webhookToken?: string;
      twilioAccountSid?: string;
      twilioAuthToken?: string;
      twilioWhatsAppFrom?: string;
      twilioMessagingServiceSid?: string;
      twilioStatusCallbackUrl?: string;
    };
    telegram?: {
      transport?: string;
      botToken?: string;
      defaultChatId?: string;
    };
  },
) {
  return requestEnvelopeData<BossNotificationSettings>('/boss/notifications/settings', token, {
    method: 'PUT',
    body: payload as unknown as JsonValue,
  });
}

export function sendBossWhatsappTest(token: string, payload: { to?: string; message?: string }) {
  return requestEnvelopeData<unknown>('/boss/notifications/whatsapp/test', token, {
    method: 'POST',
    body: payload as unknown as JsonValue,
  });
}

export function sendBossTelegramTest(token: string, payload: { to?: string; message?: string }) {
  return requestEnvelopeData<unknown>('/boss/notifications/telegram/test', token, {
    method: 'POST',
    body: payload as unknown as JsonValue,
  });
}

export function fetchMyEmployeePhotoChange(token: string) {
  return requestSuccessEnvelopeData<EmployeePhotoChangeRequest>('/api/employees/me/photo-change', token);
}

export function fetchEmployeePublicProfile(token: string, employeeId: string) {
  return requestSuccessEnvelopeData<EmployeePublicProfile>(`/api/employees/${employeeId}/profile`, token);
}

export function updateMyEmployeeProfile(
  token: string,
  payload: Partial<Pick<EmployeePublicProfile, 'name' | 'displayName' | 'age' | 'address'>>,
) {
  return requestSuccessEnvelopeData<EmployeePublicProfile>('/api/employees/me', token, {
    method: 'PATCH',
    body: payload as unknown as JsonValue,
  });
}

export function requestMyEmployeePhotoChange(token: string) {
  return requestSuccessEnvelopeData<EmployeePhotoChangeRequest>('/api/employees/me/photo-change/request', token, {
    method: 'POST',
    body: {},
  });
}

export function submitMyEmployeePhotoChange(token: string, photoUrl: string) {
  return requestSuccessEnvelopeData<EmployeePhotoChangeRequest>('/api/employees/me/photo-change/submit', token, {
    method: 'POST',
    body: { photoUrl },
  });
}

export function assignRequestToEmployee(token: string, requestId: string, employeeId: string) {
  return requestEnvelopeData<MarketplaceRequest>(`/api/marketplace/boss/requests/${requestId}/assign`, token, {
    method: 'POST',
    body: { employeeId },
  });
}

export function unassignRequestByBoss(token: string, requestId: string) {
  return requestEnvelopeData<MarketplaceRequest>(`/api/marketplace/boss/requests/${requestId}/unassign`, token, {
    method: 'POST',
    body: {},
  });
}

export function assignEmergencyToEmployee(token: string, callId: string, employeeId: string) {
  return requestEnvelopeData<MarketplaceEmergencyCall>(`/api/marketplace/boss/emergency-calls/${callId}/assign`, token, {
    method: 'POST',
    body: { employeeId },
  });
}

export function approveRequestPayment(token: string, requestId: string) {
  return requestEnvelopeData<MarketplaceRequest>(`/api/marketplace/requests/${requestId}/approve-payment`, token, {
    method: 'POST',
  });
}

export function rejectRequestPayment(token: string, requestId: string, reason: string) {
  return requestEnvelopeData<MarketplaceRequest>(`/api/marketplace/requests/${requestId}/reject-payment`, token, {
    method: 'POST',
    body: { reason },
  });
}

export function approveEmergencyPayment(token: string, callId: string) {
  return requestEnvelopeData<MarketplaceEmergencyCall>(`/api/marketplace/emergency-calls/${callId}/approve-payment`, token, {
    method: 'POST',
  });
}

export function rejectEmergencyPayment(token: string, callId: string, reason: string) {
  return requestEnvelopeData<MarketplaceEmergencyCall>(`/api/marketplace/emergency-calls/${callId}/reject-payment`, token, {
    method: 'POST',
    body: { reason },
  });
}

/**
 * POST /api/marketplace/requests/:id/proposal
 * Employee sends a proposal to move the request from ASIGNADO → NEGOCIANDO.
 */
export function sendRequestProposal(
  token: string,
  requestId: string,
  payload: {
    amount: number;
    notes?: string;
    quoteNumber?: string;
    quoteDate?: string;
    breakdown?: {
      serviceTotal?: number;
      materialTotal?: number;
      subtotal?: number;
      taxRate?: number;
      taxAmount?: number;
      total?: number;
    };
    items?: Array<{ desc: string; type: string; qty: number; price: number; amount: number }>;
    estimatePdf?: { estimateId: string };
  },
) {
  return requestEnvelopeData<MarketplaceRequest>(
    `/api/marketplace/requests/${requestId}/proposal`,
    token,
    {
      method: 'POST',
      body: payload as unknown as JsonValue,
    },
  );
}

// ============================================================
// Builder Estimates
// ============================================================

export type BuilderEstimatePayload = {
  jobSnapshot: JsonValue;
  materials: JsonValue;
  recipes: JsonValue;
  result: JsonValue;
  requestId?: string;
  description?: string;
};

/**
 * Save a mobile builder estimate to the backend and allocate a quote number.
 */
export function createBuilderEstimate(token: string, payload: BuilderEstimatePayload) {
  return requestEnvelopeData<{ estimateId: string; quoteNumber: string }>(
    '/api/builder/estimates',
    token,
    {
      method: 'POST',
      body: payload as unknown as JsonValue,
    },
  );
}

/**
 * Link a stored estimate to a marketplace request.
 */
export function linkBuilderEstimateToRequest(token: string, estimateId: string, requestId: string) {
  return requestEnvelopeData<{ estimateId: string; requestId: string }>(
    `/api/builder/estimates/${estimateId}/link-request`,
    token,
    {
      method: 'POST',
      body: { requestId } as unknown as JsonValue,
    },
  );
}

/**
 * Returns the full API path for downloading an estimate PDF.
 * Use with FileSystem.downloadAsync and an Authorization header.
 */
export function builderEstimatePdfPath(estimateId: string) {
  return `/api/builder/estimates/${estimateId}/pdf`;
}

// ============================================================
// Catalog Materials
// ============================================================

export type CatalogMaterialPayload = {
  id: string;
  name: string;
  category: string;
  baseUnit: string;
  unitPrice: number;
  currency: string;
  conversions: Array<{ from: string; to: string; factor: number }>;
  densityKgPerM3?: number;
  notes?: string;
};

/** List all company catalog materials. */
export function fetchCatalogMaterials(token: string) {
  return requestEnvelopeData<CatalogMaterialPayload[]>('/api/builder/materials', token);
}

/** Create or update a single material. */
export function upsertCatalogMaterial(token: string, material: CatalogMaterialPayload) {
  return requestEnvelopeData<CatalogMaterialPayload>(
    `/api/builder/materials/${encodeURIComponent(material.id)}`,
    token,
    { method: 'PUT', body: material as unknown as JsonValue },
  );
}

/** Delete a material by id. */
export function deleteCatalogMaterial(token: string, materialId: string) {
  return requestEnvelopeData<{ ok: boolean; id: string }>(
    `/api/builder/materials/${encodeURIComponent(materialId)}`,
    token,
    { method: 'DELETE' },
  );
}

/** Push many materials at once (initial sync from local to server). */
export function batchUpsertCatalogMaterials(token: string, materials: CatalogMaterialPayload[]) {
  return requestEnvelopeData<CatalogMaterialPayload[]>('/api/builder/materials/batch', token, {
    method: 'POST',
    body: { materials } as unknown as JsonValue,
  });
}
