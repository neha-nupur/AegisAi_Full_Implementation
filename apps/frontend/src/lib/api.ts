/**
 * AegisAI API Client
 *
 * Respects the existing backend response envelope:
 *   Success: { data: ..., traceId: "..." }
 *   Error:   { error: { code, message, details, traceId } }
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/v1').replace(/\/$/, '');

export interface ApiSuccess<T> {
  data: T;
  traceId?: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  traceId?: string;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;
  public readonly traceId?: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.code = body.code;
    this.status = status;
    this.details = body.details;
    this.traceId = body.traceId;
  }
}

function getToken(): string | null {
  return localStorage.getItem('aegisai_token');
}

export function setToken(token: string): void {
  localStorage.setItem('aegisai_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('aegisai_token');
}

export function hasToken(): boolean {
  return !!getToken();
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const resp = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Some endpoints return no body (204)
  if (resp.status === 204) {
    return undefined as unknown as T;
  }

  let json: unknown;
  try {
    json = await resp.json();
  } catch {
    throw new ApiError(resp.status, {
      code: 'PARSE_ERROR',
      message: `HTTP ${resp.status}: could not parse response`,
    });
  }

  if (!resp.ok) {
    const errBody = (json as ApiErrorResponse)?.error;
    if (errBody) {
      throw new ApiError(resp.status, errBody);
    }
    throw new ApiError(resp.status, {
      code: 'HTTP_ERROR',
      message: `HTTP ${resp.status}`,
    });
  }

  // Backend wraps in { data: ... }
  const wrapper = json as ApiSuccess<T> & { meta?: any };
  if (wrapper && 'data' in wrapper) {
    // If the data is an array, map it to the frontend's expected { items: T[], nextCursor?: string } shape.
    if (Array.isArray(wrapper.data)) {
      return {
        items: wrapper.data,
        ...(wrapper.meta || {}),
      } as unknown as T;
    }
    return wrapper.data;
  }

  // Some endpoints return the object directly (e.g. /health)
  return json as T;
}

export const api = {
  get: <T>(path: string, headers?: Record<string, string>) =>
    request<T>('GET', path, undefined, headers),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>('POST', path, body, headers),
  patch: <T>(path: string, body?: unknown) =>
    request<T>('PATCH', path, body),
  delete: <T>(path: string) =>
    request<T>('DELETE', path),
};

export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '' && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `?${qs}` : '';
}
