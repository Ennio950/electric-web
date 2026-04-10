import { signOut } from 'firebase/auth';

import { auth } from '@/src/config/firebase';
import { buildApiUrl, type MobileUrlQuery } from '@/src/config/mobileEnv';

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiRequestOptions = {
  method?: ApiMethod;
  body?: JsonValue;
  headers?: Record<string, string>;
  query?: MobileUrlQuery;
  signal?: AbortSignal;
};

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
};

type ApiSuccessEnvelope<T> = {
  success: boolean;
  data: T;
};

function getApiErrorMessage(payload: unknown, status: number) {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return `Request failed with status ${status}.`;
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => '');
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function buildRequestInit(token: string | null, options: ApiRequestOptions): RequestInit {
  const { method = 'GET', body, headers, signal } = options;

  return {
    method,
    signal,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

async function performRequest<T>(path: string, token: string | null, options: ApiRequestOptions = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(buildApiUrl(path, options.query), buildRequestInit(token, options));
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown network error.';
    throw new Error(`No se pudo conectar con la API: ${reason}`);
  }

  const payload = await parseResponsePayload(response);
  if (!response.ok) {
    throw new ApiError(response.status, getApiErrorMessage(payload, response.status), payload);
  }

  return payload as T;
}

export function requestJson<T>(path: string, token: string, options?: ApiRequestOptions) {
  return performRequest<T>(path, token, options);
}

export async function requestEnvelopeData<T>(path: string, token: string, options?: ApiRequestOptions) {
  const payload = await performRequest<ApiEnvelope<T>>(path, token, options);
  return payload.data;
}

export async function requestSuccessEnvelopeData<T>(path: string, token: string, options?: ApiRequestOptions) {
  const payload = await performRequest<ApiSuccessEnvelope<T>>(path, token, options);
  return payload.data;
}

export function requestPublicJson<T>(path: string, options?: ApiRequestOptions) {
  return performRequest<T>(path, null, options);
}

export async function withCurrentToken<T>(operation: (token: string) => Promise<T>) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user available.');
  }

  try {
    const token = await user.getIdToken();
    return await operation(token);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      await signOut(auth).catch(() => undefined);
    }

    throw error;
  }
}
