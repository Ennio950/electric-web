import { appRoutes, type AppRouteHref } from '@/src/navigation/routes';
import type { MobileUserRole } from '@/src/types/api';

type NotificationRouteData = {
  href?: unknown;
  pathname?: unknown;
  entityType?: unknown;
  sourceType?: unknown;
  role?: unknown;
  recordId?: unknown;
  requestId?: unknown;
  emergencyId?: unknown;
  paymentId?: unknown;
  targetId?: unknown;
  screen?: unknown;
};

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asAbsoluteRoute(value: string | null): `/${string}` | null {
  if (!value || !value.startsWith('/')) {
    return null;
  }

  return value as `/${string}`;
}

function resolveEntityHref(
  entityType: string,
  recordId: string,
  role: MobileUserRole,
  sourceType: string | null,
): AppRouteHref | null {
  if (entityType === 'builder') {
    return appRoutes.builderHome;
  }

  if (entityType === 'request') {
    if (role === 'boss') {
      return appRoutes.bossQueueDetail(recordId, 'request');
    }
    if (role === 'client') {
      return appRoutes.clientRequestDetail(recordId);
    }
    return appRoutes.employeeRequestDetail(recordId);
  }

  if (entityType === 'emergency') {
    if (role === 'boss') {
      return appRoutes.bossQueueDetail(recordId, 'emergency');
    }
    if (role === 'client') {
      return appRoutes.clientEmergencyDetail(recordId);
    }
    return appRoutes.employeeEmergencyDetail(recordId);
  }

  if (entityType === 'payment') {
    if (role === 'boss') {
      return appRoutes.bossPaymentDetail(
        recordId,
        sourceType === 'emergency' ? 'emergency' : 'request',
      );
    }

    if ((sourceType ?? 'request') === 'emergency') {
      return role === 'client'
        ? appRoutes.clientEmergencyDetail(recordId)
        : appRoutes.employeeEmergencyDetail(recordId);
    }

    return role === 'client'
      ? appRoutes.clientRequestDetail(recordId)
      : appRoutes.employeeRequestDetail(recordId);
  }

  return null;
}

export function resolveNotificationHref(data: unknown, fallbackRole: MobileUserRole | null) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const payload = data as NotificationRouteData;
  const directHref = asAbsoluteRoute(asString(payload.href) ?? asString(payload.pathname));
  if (directHref) {
    return directHref;
  }

  const role = (asString(payload.role) as MobileUserRole | null) ?? fallbackRole;
  if (!role) {
    return null;
  }

  const screen = asString(payload.screen);
  if (screen === 'builder') {
    return appRoutes.builderHome;
  }

  const entityType = asString(payload.entityType);
  const sourceType = asString(payload.sourceType);
  const recordId =
    asString(payload.recordId)
    ?? asString(payload.requestId)
    ?? asString(payload.emergencyId)
    ?? asString(payload.paymentId)
    ?? asString(payload.targetId);

  if (entityType && recordId) {
    return resolveEntityHref(entityType, recordId, role, sourceType);
  }

  return null;
}
