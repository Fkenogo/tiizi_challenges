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
export async function apiFetch<T>(path: string): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new ApiError(401, 'not_signed_in', 'Sign-in is required');

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
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
