import { router, type Href } from 'expo-router';

import type { MobileUserRole, ReviewQueueSourceType } from '@/src/types/api';

type StaticAppRoute =
  | '/(auth)/apply-employee'
  | '/(auth)/login'
  | '/(auth)/magic-client'
  | '/(auth)/signup-client'
  | '/(boss)'
  | '/(boss)/admin'
  | '/(boss)/payments'
  | '/(boss)/queue'
  | '/(boss)/settings'
  | '/(builder)'
  | '/(builder)/materials'
  | '/(builder)/recipes'
  | '/(builder)/estimate-preview'
  | '/(client)'
  | '/(client)/emergency'
  | '/(client)/emergency/new'
  | '/(client)/requests'
  | '/(client)/requests/new'
  | '/(employee)'
  | '/(employee)/emergency/new'
  | '/(employee)/profile'
  | '/(employee)/requests';

type DynamicAppRoute =
  | { pathname: '/(boss)/payments/[id]'; params: { id: string; sourceType?: ReviewQueueSourceType } }
  | { pathname: '/(boss)/queue/[id]'; params: { id: string; sourceType?: ReviewQueueSourceType } }
  | { pathname: '/(builder)/jobs/[id]'; params: { id: string } }
  | { pathname: '/(builder)/estimate-preview/[id]'; params: { id: string } }
  | { pathname: '/(client)/emergency/[id]'; params: { id: string } }
  | { pathname: '/(client)/requests/[id]'; params: { id: string } }
  | { pathname: '/(employee)/emergency/[id]'; params: { id: string } }
  | { pathname: '/(employee)/requests/[id]'; params: { id: string } };

type DirectAppRoute = `/${string}`;

export type AppRouteHref = StaticAppRoute | DynamicAppRoute | DirectAppRoute;
export type RoleHomeRoute = '/(boss)' | '/(client)' | '/(employee)';

function stringifyId(id: string | number) {
  return String(id);
}

export const appRoutes = {
  authApplyEmployee: '/(auth)/apply-employee' as const,
  authLogin: '/(auth)/login' as const,
  authMagicClient: '/(auth)/magic-client' as const,
  authSignupClient: '/(auth)/signup-client' as const,
  bossHome: '/(boss)' as const,
  bossAdmin: '/(boss)/admin' as const,
  bossPayments: '/(boss)/payments' as const,
  bossQueue: '/(boss)/queue' as const,
  bossSettings: '/(boss)/settings' as const,
  builderHome: '/(builder)' as const,
  builderMaterials: '/(builder)/materials' as const,
  builderRecipes: '/(builder)/recipes' as const,
  clientHome: '/(client)' as const,
  clientEmergency: '/(client)/emergency' as const,
  clientEmergencyNew: '/(client)/emergency/new' as const,
  clientRequests: '/(client)/requests' as const,
  clientRequestsNew: '/(client)/requests/new' as const,
  employeeHome: '/(employee)' as const,
  employeeEmergencyNew: '/(employee)/emergency/new' as const,
  employeeProfile: '/(employee)/profile' as const,
  employeeRequests: '/(employee)/requests' as const,
  bossPaymentDetail(id: string | number, sourceType?: ReviewQueueSourceType): AppRouteHref {
    const params: { id: string; sourceType?: ReviewQueueSourceType } = { id: stringifyId(id) };
    if (sourceType) {
      params.sourceType = sourceType;
    }
    return { pathname: '/(boss)/payments/[id]', params };
  },
  bossQueueDetail(id: string | number, sourceType?: ReviewQueueSourceType): AppRouteHref {
    const params: { id: string; sourceType?: ReviewQueueSourceType } = { id: stringifyId(id) };
    if (sourceType) {
      params.sourceType = sourceType;
    }
    return { pathname: '/(boss)/queue/[id]', params };
  },
  builderJobDetail(id: string | number): AppRouteHref {
    return { pathname: '/(builder)/jobs/[id]', params: { id: stringifyId(id) } };
  },
  builderEstimatePreview(jobId: string | number): AppRouteHref {
    return { pathname: '/(builder)/estimate-preview/[id]', params: { id: stringifyId(jobId) } };
  },
  clientEmergencyDetail(id: string | number): AppRouteHref {
    return { pathname: '/(client)/emergency/[id]', params: { id: stringifyId(id) } };
  },
  clientRequestDetail(id: string | number): AppRouteHref {
    return { pathname: '/(client)/requests/[id]', params: { id: stringifyId(id) } };
  },
  employeeEmergencyDetail(id: string | number): AppRouteHref {
    return { pathname: '/(employee)/emergency/[id]', params: { id: stringifyId(id) } };
  },
  employeeRequestDetail(id: string | number): AppRouteHref {
    return { pathname: '/(employee)/requests/[id]', params: { id: stringifyId(id) } };
  },
} as const;

export function getRoleHomeRoute(role: MobileUserRole | null | undefined): RoleHomeRoute {
  if (role === 'boss') {
    return appRoutes.bossHome;
  }

  if (role === 'employee') {
    return appRoutes.employeeHome;
  }

  return appRoutes.clientHome;
}

export function toExpoHref(href: AppRouteHref): Href {
  // Expo typedRoutes omits some grouped role paths in this app, so keep the cast centralized.
  return href as unknown as Href;
}

export function pushAppRoute(href: AppRouteHref) {
  router.push(toExpoHref(href));
}

export function replaceAppRoute(href: AppRouteHref) {
  router.replace(toExpoHref(href));
}
