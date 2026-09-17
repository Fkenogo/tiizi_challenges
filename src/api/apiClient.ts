import { auth } from '../lib/firebaseAuth';
import {
  resolveKnowledgeAuthorityMode,
  type KnowledgeAuthorityMode,
} from './knowledgeAuthorityMode';

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
 *
 * Superseded by tiiziKnowledgeAuthorityMode(): an explicit
 * VITE_TIIZI_KNOWLEDGE_AUTHORITY_MODE wins; otherwise this flag maps to
 * transition (true) or firestore (false/unset).
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

/** Authenticated transport shared by apiFetch and apiFetchRaw. */
async function authorizedFetch(path: string, init?: ApiRequestInit): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new ApiError(401, 'not_signed_in', 'Sign-in is required');

  try {
    return await fetch(`${apiBaseUrl()}${path}`, {
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
}

export async function apiFetch<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const response = await authorizedFetch(path, init);

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

/** Non-throwing transport result for endpoints whose error body carries data. */
export interface ApiRawResult<T> {
  status: number;
  ok: boolean;
  data: T | null;
}

/**
 * Same authenticated transport as apiFetch, but does NOT throw on a non-2xx
 * response. Use only where the governed error body itself is meaningful to
 * the caller (e.g. the S2a preview seam returns 422 `{ ok:false, issues }`).
 * Network/credential failures still throw ApiError so callers never treat an
 * unreachable API as a domain answer.
 */
export async function apiFetchRaw<T>(path: string, init?: ApiRequestInit): Promise<ApiRawResult<T>> {
  const response = await authorizedFetch(path, init);
  let data: T | null = null;
  try {
    data = (await response.json()) as T;
  } catch {
    data = null;
  }
  return { status: response.status, ok: response.ok, data };
}

/**
 * Effective frontend Knowledge authority mode. Explicit
 * VITE_TIIZI_KNOWLEDGE_AUTHORITY_MODE wins; otherwise the legacy
 * VITE_TIIZI_KNOWLEDGE_API_ENABLED flag maps to transition/firestore.
 */
export function tiiziKnowledgeAuthorityMode(): KnowledgeAuthorityMode {
  return resolveKnowledgeAuthorityMode(
    import.meta.env as Record<string, string | undefined>,
    isTiiziKnowledgeApiEnabled(),
  );
}
