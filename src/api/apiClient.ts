import { auth } from '../lib/firebaseAuth';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function isTiiziApiEnabled(): boolean {
  return import.meta.env.VITE_TIIZI_API_ENABLED === 'true';
}

/**
 * Phase B Knowledge cutover flag. Knowledge-selection UI and canonical
 * Knowledge admin writes go through the Tiizi API (PostgreSQL authority)
 * only when this is 'true'; otherwise the legacy Firestore paths run
 * unchanged. Safe rollback is unsetting the flag. Remove the Firestore
 * branches once parity is proven and PostgreSQL is the sole authority.
 */
export function isTiiziKnowledgeApiEnabled(): boolean {
  return import.meta.env.VITE_TIIZI_KNOWLEDGE_API_ENABLED === 'true';
}

function apiBaseUrl(): string {
  const base = import.meta.env.VITE_TIIZI_API_BASE_URL as string | undefined;
  if (!base) throw new ApiError(500, 'api_misconfigured', 'VITE_TIIZI_API_BASE_URL is not set');
  return base.replace(/\/+$/, '');
}

/**
 * Provider-neutral Tiizi API client. Feature code must use this seam instead
 * of reaching Firebase directly. Token acquisition stays inside this module so
 * callers never know the token provider's internals.
 */
export interface ApiRequestInit {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
}

export async function apiFetch<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new ApiError(401, 'not_signed_in', 'Sign-in is required');

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(503, 'api_unreachable', 'Tiizi API is unreachable');
  }

  if (!response.ok) {
    let code = 'request_error';
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      if (body.error?.code) code = body.error.code;
      if (body.error?.message) message = body.error.message;
    } catch {
      // Keep the generic message when the body is not JSON.
    }
    throw new ApiError(response.status, code, message);
  }
  return (await response.json()) as T;
}
