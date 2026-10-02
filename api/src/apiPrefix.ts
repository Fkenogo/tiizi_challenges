/**
 * Canonical active API namespace prefix — the single server-side source of
 * truth for the Tiizi API path prefix.
 *
 * `/api` is a PRODUCT-NEUTRAL namespace. It carries no API-version meaning.
 *
 * It deliberately does NOT reuse the retired `/v1` prefix: `/v1` was an
 * informal, undocumented convention that read as if it versioned the API, and
 * collided conceptually with the ARCHIVED Product V1 browser routes (`/app/*`).
 * `/v1` never had versioning authority, a published contract, or any external
 * consumer. See `docs/architecture/TIIZI-API-NAMESPACE-CORRECTION-001.md`.
 *
 * There is intentionally NO `/v1` compatibility alias, redirect, proxy, or
 * fallback registration anywhere in this service. A request to `/v1/*` is not
 * an active API surface and must not silently reach the current API.
 *
 * Archived Product V1 remains excluded from V2 engineering consideration; see
 * the repository-root `AGENTS.md`.
 */
export const API_PREFIX = '/api';

/** Prefix a route path with the canonical active API namespace. */
export const apiPath = (path: string): string => `${API_PREFIX}${path}`;
