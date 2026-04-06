export type MobileUserRole = 'client' | 'employee' | 'boss';

export type MobilePhotoMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

export type MobilePhotoPolicy = {
  maxUploadBytes: number;
  maxImageDimension: number;
  compressionTargetBytes: number;
  allowedMimeTypes: MobilePhotoMimeType[];
};

export type MobileCompanyConfig = {
  companyName: string;
  timezone: string;
  locale: string;
  currency: string;
  logoUrl: string | null;
  supportPhone: string | null;
  whatsappNumber: string | null;
  photoPolicy: MobilePhotoPolicy;
};

export type MobileFeatureFlags = {
  employeeHome: boolean;
  bossHome: boolean;
  emergencyFlow: boolean;
  paymentReview: boolean;
  builderMobile: boolean;
  pushNotifications: boolean;
};

export type MobileBootstrapUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

export type MobileBootstrapResponse = {
  user: MobileBootstrapUser;
  role: MobileUserRole;
  featureFlags: MobileFeatureFlags;
  companyConfig: MobileCompanyConfig;
};

export type MobileEmployeeHomeResponse = {
  role: 'employee';
  summary: {
    openRequests: number;
    assignedRequests: number;
    inProgressRequests: number;
    activeEmergencyCount: number;
  };
};

export type MobileBossHomeResponse = {
  role: 'boss';
  summary: {
    pendingRequests: number;
    activeEmergencies: number;
    pendingPayments: number;
    reviewQueue: number;
  };
};

export type MobileClientHomeResponse = {
  role: 'client';
  summary: {
    totalRequests: number;
    activeRequests: number;
    awaitingMyAction: number;
    completedRequests: number;
  };
};

export type MobileHomeResponse =
  | MobileClientHomeResponse
  | MobileEmployeeHomeResponse
  | MobileBossHomeResponse;

export type RegisterPushTokenRequest = {
  token: string;
  platform: 'ios' | 'android';
  appVersion: string;
  deviceId: string;
};

export type MarketplaceRequestStatus =
  | 'EN_ESPERA'
  | 'ASIGNADO'
  | 'NEGOCIANDO'
  | 'EN_PROCESO'
  | 'ESPERANDO_CIERRE_CLIENTE'
  | 'ESPERANDO_COMPROBANTE_PAGO'
  | 'PAGO_PENDIENTE_REVISION'
  | 'COMPLETADO'
  | string;

export type MarketplaceRequest = {
  id: string;
  status: MarketplaceRequestStatus;
  category: string | null;
  description: string | null;
  address: string | null;
  photoUrl: string | null;
  proposal: unknown | null;
  clientId: string | null;
  clientEmail: string | null;
  clientNickname: string | null;
  assignedEmployeeId: string | null;
  employeeName: string | null;
  employeeEmail: string | null;
  finalAmount: number | null;
  clientRating: number | null;
  paymentProofUrl: string | null;
  paymentProofAt: string | null;
  paymentRejectionReason: string | null;
  finalPhotoUrl: string | null;
  bossApprovedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type EmergencyDispatchMode = 'emergency' | 'scheduled' | string;
export type EmergencyCallStatus =
  | 'pending'
  | 'accepted'
  | 'awaiting_client_close'
  | 'awaiting_payment_proof'
  | 'payment_pending_review'
  | 'completed'
  | string;

export type MarketplaceEmergencyCall = {
  id: string;
  status: EmergencyCallStatus;
  dispatchMode: EmergencyDispatchMode | null;
  priority: string | null;
  issue: string | null;
  location: string | null;
  phone: string | null;
  eta: number | null;
  clientId: string | null;
  clientEmail: string | null;
  clientName: string | null;
  assignedEmployeeId: string | null;
  assignedEmployeeEmail: string | null;
  assignedEmployeeName: string | null;
  quotedAmount: number | null;
  finalAmount: number | null;
  clientRating: number | null;
  finalPhotoUrl: string | null;
  paymentProofUrl: string | null;
  paymentProofAt: string | null;
  paymentRejectionReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  createdAtMs: number | null;
  updatedAtMs: number | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  scheduledFor: string | null;
  clientCoords: { lat: number; lng: number } | null;
  employeeCoords: { lat: number; lng: number } | null;
};

export type ReviewQueueSourceType = 'request' | 'emergency';

export type BossReviewQueueItem = {
  sourceType: ReviewQueueSourceType;
  sourceLabel: string | null;
  recordId: string;
  queueId: string;
  status: string;
  amount: number;
  paymentProofAt: string | null;
  paymentProofAtMs: number | null;
  paymentProofUrl: string | null;
  employeeId: string | null;
  employeeName: string | null;
  employeeEmail: string | null;
  clientId: string | null;
  clientName: string | null;
  clientEmail: string | null;
  description: string | null;
  address: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type EmployeeDirectoryItem = {
  id: string;
  uid: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
};

export type BossEmployeeRequest = {
  id: string;
  uid: string;
  email: string | null;
  name?: string | null;
  displayName?: string | null;
  status: string;
  phone: string | null;
  address: string | null;
  photoUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  decidedAt: string | null;
  decidedBy?: string | null;
};

export type BossPhotoChangeRequest = {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  status: string;
  currentPhotoUrl: string | null;
  newPhotoUrl: string | null;
  requestedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  completedAt?: string | null;
};

export type BossEarningsSummary = {
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
  count: number;
};

export type BossEarningsHistoryItem = {
  id: string;
  requestId: string | null;
  finalAmount: number | null;
  commission: number | null;
  employeeId: string | null;
  employeeName: string | null;
  employeeEmail: string | null;
  description: string | null;
  address: string | null;
  createdAt: string | null;
};

export type BossEarningsPayload = {
  summary: BossEarningsSummary;
  commissionRate: number;
  history?: BossEarningsHistoryItem[];
};

export type BossCompanyConfig = {
  displayName: string;
  legalName: string;
  tagline: string;
  logoUrl: string;
  phone: string;
  whatsappNumber: string;
  timezone: string;
  locale: string;
  currency: string;
  email: string;
  address: string;
};

export type BossNotificationChannel = {
  channel: string;
  provider?: string;
  transport: string;
  transportConfigured: boolean;
  simulated: boolean;
  deliveryReady: boolean;
  hasConfiguredRecipient: boolean;
  configuredRecipientPreview: string;
  ready: boolean;
  mode: string;
  notes: string[];
};

export type BossNotificationChannelsPayload = {
  whatsapp: BossNotificationChannel;
  telegram: BossNotificationChannel;
};

export type BossNotificationSettings = {
  whatsapp: {
    alertNumber: string;
    transport: 'noop' | 'webhook' | 'twilio' | string;
    webhookUrl: string;
    webhookTokenMasked: string;
    hasWebhookToken: boolean;
    twilioAccountSid: string;
    twilioAuthTokenMasked: string;
    hasTwilioAuthToken: boolean;
    twilioWhatsAppFrom: string;
    twilioMessagingServiceSid: string;
    twilioStatusCallbackUrl: string;
  };
  telegram: {
    transport: 'disabled' | 'noop' | 'api' | string;
    botTokenMasked: string;
    hasBotToken: boolean;
    defaultChatId: string;
  };
};

export type EmployeePhotoChangeRequest = {
  status: string;
  id?: string;
  uid?: string | null;
  email?: string | null;
  displayName?: string | null;
  currentPhotoUrl?: string | null;
  newPhotoUrl?: string | null;
  requestedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  completedAt?: string | null;
  updatedAt?: string | null;
};

export type EmployeePortfolioItem = {
  url: string;
  addedAt?: string | null;
};

export type EmployeeRatingSummary = {
  average: number;
  totalRatings: number;
  totalSum?: number;
};

export type EmployeePublicProfile = {
  id: string;
  name: string | null;
  displayName: string | null;
  email: string | null;
  portfolio: EmployeePortfolioItem[];
  rating: EmployeeRatingSummary;
  createdAt: string | null;
  age: number | null;
  photoUrl: string | null;
  profilePhoto: string | null;
  address: string | null;
};

export type ChatMessage = {
  id: string;
  text: string;
  senderId: string;
  senderRole: string;
  senderName: string;
  isInternal: boolean;
  attachments: string[];
  createdAt: string | null;
};
