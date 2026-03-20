export type PortalRole = 'employee' | 'boss';

export const PORTAL_ROLE_KEY = 'swe:portalRole';
export const PORTAL_AUTH_TS_KEY = 'swe:portalAuthAt';
export const MAX_SESSION_AGE_MS = 1000 * 60 * 60 * 24 * 7;

const BUILDER_ENTRY = 'builder-react/dist/index.html#/';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export type PortalSession = {
  role: string;
  authAt: number;
};

export type PortalAccessResult = {
  allowed: boolean;
  reason: string;
  role: PortalRole | null;
};

export function clearPortalSessionMetadata(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(PORTAL_ROLE_KEY);
  storage.removeItem(PORTAL_AUTH_TS_KEY);
}

function isAllowedRole(role: string): role is PortalRole {
  return role === 'employee' || role === 'boss';
}

function normalizeOriginValue(value: string): string {
  return String(value || '').replace(/\/+$/, '');
}

function tryParseHttpOrigin(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(String(hostname || '').toLowerCase());
}

function isTrustedHostOrigin(candidate: URL, current: URL): boolean {
  if (candidate.origin === current.origin) return true;
  if (candidate.hostname === current.hostname) return true;
  return isLoopbackHost(candidate.hostname) && isLoopbackHost(current.hostname);
}

export function normalizePortalRole(value: unknown): PortalRole | null {
  const role = String(value || '').trim().toLowerCase();
  return isAllowedRole(role) ? role : null;
}

export function getHostOrigin(search: string, origin: string): string {
  const fallbackOrigin = normalizeOriginValue(origin);
  const params = new URLSearchParams(search || '');
  const rawHostOrigin = String(params.get('hostOrigin') || '').trim();
  if (!rawHostOrigin) {
    return fallbackOrigin;
  }

  const candidate = tryParseHttpOrigin(rawHostOrigin);
  const current = tryParseHttpOrigin(fallbackOrigin);
  if (!candidate || !current) {
    return fallbackOrigin;
  }

  return isTrustedHostOrigin(candidate, current) ? candidate.origin : fallbackOrigin;
}

export function getReturnToPath(pathname: string): string {
  return pathname.includes('/builder-react/dist/index.html') ? BUILDER_ENTRY : '';
}

export function buildPortalUrl(hostOrigin: string, relativePath: string, returnTo = ''): string {
  const base = hostOrigin.endsWith('/') ? hostOrigin : `${hostOrigin}/`;
  const url = new URL(relativePath, base);
  if (returnTo) {
    url.searchParams.set('returnTo', returnTo);
  }
  return url.toString();
}

export function readPortalSession(storage: Pick<Storage, 'getItem'>): PortalSession {
  return {
    role: String(storage.getItem(PORTAL_ROLE_KEY) || '').trim().toLowerCase(),
    authAt: Number.parseInt(storage.getItem(PORTAL_AUTH_TS_KEY) || '', 10),
  };
}

export function hydratePortalSessionFromSearch(
  search: string,
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  now = Date.now(),
): PortalSession {
  const params = new URLSearchParams(search || '');
  const queryRole = normalizePortalRole(params.get('portalRole'));

  if (queryRole) {
    storage.setItem(PORTAL_ROLE_KEY, queryRole);
    storage.setItem(PORTAL_AUTH_TS_KEY, String(now));
  }

  return readPortalSession(storage);
}

export async function validatePortalAccess({
  fetchImpl,
  hostOrigin,
  session,
  storage,
  now = Date.now(),
}: {
  fetchImpl: typeof fetch;
  hostOrigin: string;
  session: PortalSession;
  storage?: Pick<Storage, 'removeItem'>;
  now?: number;
}): Promise<PortalAccessResult> {
  const role = normalizePortalRole(session.role);
  if (!role) {
    storage && clearPortalSessionMetadata(storage);
    return { allowed: false, reason: 'role', role: null };
  }

  if (!Number.isFinite(session.authAt)) {
    storage && clearPortalSessionMetadata(storage);
    return { allowed: false, reason: 'timestamp', role };
  }

  if (now - session.authAt > MAX_SESSION_AGE_MS) {
    storage && clearPortalSessionMetadata(storage);
    return { allowed: false, reason: 'expired', role };
  }

  try {
    const response = await fetchImpl(`${hostOrigin}/api/${role}/me`, {
      method: 'GET',
      credentials: 'include',
    });

    if (response.ok) {
      return { allowed: true, reason: 'ok', role };
    }

    if (response.status === 401 || response.status === 403) {
      storage && clearPortalSessionMetadata(storage);
      return { allowed: false, reason: 'server_rejected', role };
    }

    return { allowed: false, reason: 'server_error', role };
  } catch {
    return { allowed: false, reason: 'network', role };
  }
}
