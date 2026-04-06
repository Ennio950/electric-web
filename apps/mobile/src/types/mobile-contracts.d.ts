declare module '@electric/mobile-contracts' {
  export type MobileContractRole = 'client' | 'employee' | 'boss';
  export type MobileContractChatMessage = {
    id: string;
    text: string;
    senderId: string;
    senderRole: string;
    senderName: string;
    isInternal: boolean;
    attachments: string[];
    createdAt: string | null;
  };
  export type MobileContractReviewQueueSourceType = 'request' | 'emergency';
  export type MobileNotificationTarget =
    | { kind: 'href'; href: `/${string}` }
    | { kind: 'builder' }
    | { kind: 'bossQueue'; recordId: string; sourceType: MobileContractReviewQueueSourceType }
    | { kind: 'bossPayment'; recordId: string; sourceType: MobileContractReviewQueueSourceType }
    | { kind: 'clientRequest'; recordId: string }
    | { kind: 'clientEmergency'; recordId: string }
    | { kind: 'employeeRequest'; recordId: string }
    | { kind: 'employeeEmergency'; recordId: string };
  export const MOBILE_USER_ROLES: readonly MobileContractRole[];
  export const MOBILE_LOGIN_ROUTE: '/(auth)/login';

  export function normalizeMobileUserRole(value: unknown, fallback?: MobileContractRole): MobileContractRole;
  export function normalizeReviewQueueSourceType(
    value: unknown,
    fallback?: MobileContractReviewQueueSourceType,
  ): MobileContractReviewQueueSourceType;
  export function isBossPaymentReviewPending(
    sourceType: unknown,
    status: unknown,
  ): boolean;
  export function isBossQueueAssignable(
    sourceType: unknown,
    status: unknown,
    assignedEmployeeId?: unknown,
  ): boolean;
  export function isBossQueueUnassignable(
    sourceType: unknown,
    status: unknown,
    assignedEmployeeId?: unknown,
  ): boolean;
  export function resolveMobileNotificationTarget(
    data: unknown,
    fallbackRole?: unknown,
  ): MobileNotificationTarget | null;
  export function getMobileRoleHomeRoute(role: unknown): '/(client)' | '/(employee)' | '/(boss)';
  export function resolveMobileEntryRoute(input: {
    isLoading?: boolean;
    isAuthenticated?: boolean;
    isWeb?: boolean;
    role?: unknown;
  }): '/(auth)/login' | '/(client)' | '/(employee)' | '/(boss)' | null;
  export function resolveMobileRoleGuardRoute(input: {
    isLoading?: boolean;
    isAuthenticated?: boolean;
    role?: unknown;
    expectedRole?: unknown;
  }): '/(auth)/login' | '/(client)' | '/(employee)' | '/(boss)' | null;
  export function resolveMobileBuilderRoute(input: {
    isLoading?: boolean;
    isAuthenticated?: boolean;
    role?: unknown;
    builderEnabled?: boolean;
  }): '/(auth)/login' | '/(client)' | '/(employee)' | '/(boss)' | null;
  export function buildMobileBootstrapResponse(input?: unknown): unknown;

  export function decorateMarketplaceRequest(input: unknown): unknown;
  export function decorateMarketplaceRequestList(items: unknown): unknown[];

  export function decorateMarketplaceEmergencyCall(input: unknown): unknown;
  export function decorateMarketplaceEmergencyCallList(items: unknown): unknown[];

  export function decorateBossReviewQueue(items: unknown): unknown[];
  export function decorateEmployeeDirectory(items: unknown): unknown[];
  export function normalizeChatMessage(input: unknown): MobileContractChatMessage | null;
  export function decorateChatMessage(input: unknown): MobileContractChatMessage | null;
  export function decorateChatMessageList(items: unknown): MobileContractChatMessage[];
}
