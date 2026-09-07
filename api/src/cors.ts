/**
 * Production CORS contract for the Tiizi API.
 *
 * Allowed origins are controlled exclusively by TIIZI_ALLOWED_ORIGINS:
 * a comma-separated list of exact origins (scheme + authority, no path).
 *
 * Safety properties:
 * - No wildcard fallback exists anywhere in this module. An empty/unset
 *   variable means cross-origin requests are denied (same-origin only),
 *   never silently allowed.
 * - `*` entries are rejected as configuration errors.
 * - Invalid entries throw at startup (fail fast) with a message naming the
 *   offending value. Origin allowlists are non-secret configuration, so
 *   naming the value cannot leak credentials.
 */

/** Environment variable carrying the comma-separated origin allowlist. */
export const ALLOWED_ORIGINS_ENV = 'TIIZI_ALLOWED_ORIGINS';

function validateOrigin(value: string): string {
  if (value.includes('*')) {
    throw new Error(
      `Invalid ${ALLOWED_ORIGINS_ENV} entry ${JSON.stringify(value)}: ` +
        'wildcards are not allowed; configure exact origins.',
    );
  }
  const match = /^(https?:\/\/)([^/?#\s]+)$/.exec(value);
  if (!match) {
    throw new Error(
      `Invalid ${ALLOWED_ORIGINS_ENV} entry ${JSON.stringify(value)}: ` +
        'expected an exact origin such as https://app.example (http/https, no path, query, or trailing slash).',
    );
  }
  const authority = match[2] as string;
  const colon = authority.lastIndexOf(':');
  if (colon !== -1 && colon < authority.length - 1) {
    const portText = authority.slice(colon + 1);
    if (!/^\d{1,5}$/.test(portText) || Number(portText) < 1 || Number(portText) > 65535) {
      throw new Error(
        `Invalid ${ALLOWED_ORIGINS_ENV} entry ${JSON.stringify(value)}: ` +
          'port must be a number between 1 and 65535.',
      );
    }
  }
  return value;
}

/**
 * Parse a raw TIIZI_ALLOWED_ORIGINS value into exact origins.
 * Trims whitespace, drops empty entries, rejects invalid entries clearly.
 */
export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .map(validateOrigin);
}

/** Read the allowlist from the environment. Throws on invalid configuration. */
export function allowedOriginsFromEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  return parseAllowedOrigins(env[ALLOWED_ORIGINS_ENV]);
}
