import { z } from 'zod';

import { appRoutes, type AppRouteHref } from '@/src/navigation/routes';
import type { MobileUserRole } from '@/src/types/api';

const notificationRouteSchema = z.object({
  href: z.string().optional(),
  pathname: z.string().optional(),
  entityType: z.string().optional(),
  sourceType: z.string().optional(),
  role: z.string().optional(),
  recordId: z.string().optional(),
  requestId: z.string().optional(),
  emergencyId: z.string().optional(),
  paymentId: z.string().optional(),
  targetId: z.string().optional(),
  screen: z.string().optional(),
}).passthrough();

type NotificationRouteData = z.infer<typeof notificationRouteSchema>;

function parseNotificationData(data: unknown): NotificationRouteData | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const result = notificationRouteSchema.safeParse(data);
  if (!result.success) {
    console.warn('[NotificationRouting] Invalid notification data:', result.error.message);
    return null;
  }

  return result.data;
}

function trimOrNull(value: string | undefined): string | null {
  return value?.trim() || null;
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
  const payload = parseNotificationData(data);
  if (!payload) {
    return null;
  }

  const directHref = asAbsoluteRoute(trimOrNull(payload.href) ?? trimOrNull(payload.pathname));
  if (directHref) {
    return directHref;
  }

  const role = (trimOrNull(payload.role) as MobileUserRole | null) ?? fallbackRole;
  if (!role) {
    return null;
  }

  const screen = trimOrNull(payload.screen);
  if (screen === 'builder') {
    return appRoutes.builderHome;
  }

  const entityType = trimOrNull(payload.entityType);
  const sourceType = trimOrNull(payload.sourceType);
  const recordId =
    trimOrNull(payload.recordId)
    ?? trimOrNull(payload.requestId)
    ?? trimOrNull(payload.emergencyId)
    ?? trimOrNull(payload.paymentId)
    ?? trimOrNull(payload.targetId);

  if (entityType && recordId) {
    return resolveEntityHref(entityType, recordId, role, sourceType);
  }

  return null;
}
