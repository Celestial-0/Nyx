import { createRequestId } from '@/types/common';

import { API_BASE_URL } from '../env';

/**
 * Core HTTP client. Ported from the web client's `lib/api.ts`, trimmed to the
 * APIs that exist in React Native (global `fetch`, `Headers`, `FormData`,
 * `Blob`, `URLSearchParams` are all available under Hermes + RN).
 *
 * `apiRequest<T>` returns the unwrapped `data` payload. Callers are expected to
 * validate it with the matching Zod schema from `@/types`, e.g.
 *
 *   const raw = await apiRequest('/auth/session', { accessToken });
 *   const session = SessionResponseSchema.parse(raw);
 */

export type ApiErrorResponse = {
  success: false;
  error: string;
  message: string;
  details?: unknown;
};

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

export class ApiRequestError extends Error {
  status: number;
  code: string | null;
  details: unknown;
  requestId: string | null;

  constructor(input: {
    status: number;
    message: string;
    code?: string | null;
    details?: unknown;
    requestId?: string | null;
  }) {
    super(input.message);
    this.name = 'ApiRequestError';
    this.status = input.status;
    this.code = input.code ?? null;
    this.details = input.details ?? null;
    this.requestId = input.requestId ?? null;
  }
}

export async function readApiError(response: Response): Promise<ApiRequestError> {
  const fallback = `Request failed with status ${response.status}`;
  const requestId =
    response.headers.get('x-request-id') ??
    response.headers.get('x-correlation-id') ??
    null;

  try {
    const data = (await response.json()) as Partial<ApiErrorResponse>;

    return new ApiRequestError({
      status: response.status,
      message: data.message || data.error || fallback,
      code: data.error,
      details: data.details,
      requestId,
    });
  } catch {
    return new ApiRequestError({ status: response.status, message: fallback, requestId });
  }
}

type JsonBody = Record<string, unknown> | unknown[] | string | number | boolean | null;

export type ApiRequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
  accessToken?: string | null;
  body?: BodyInit | JsonBody;
  headers?: HeadersInit;
};

function resolveApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function isNativeBody(body: unknown): body is BodyInit {
  return (
    typeof body === 'string' ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    body instanceof URLSearchParams
  );
}

function buildRequestBody(
  body: ApiRequestOptions['body'],
  headers: Headers
): BodyInit | undefined {
  if (body === undefined) {
    return undefined;
  }

  if (isNativeBody(body)) {
    return body;
  }

  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return JSON.stringify(body);
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { accessToken, body, headers, ...init } = options;
  const requestHeaders = new Headers(headers);

  if (!requestHeaders.has('x-request-id')) {
    requestHeaders.set('x-request-id', createRequestId());
  }

  if (accessToken) {
    requestHeaders.set('authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(resolveApiUrl(path), {
    ...init,
    headers: requestHeaders,
    body: buildRequestBody(body, requestHeaders),
  });

  if (!response.ok) {
    throw await readApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as ApiSuccessResponse<T>;
  return payload.data;
}
