/**
 * Where Support Tiizi's Back control goes. The entry point passes its own path
 * as `state.from`; only a plain in-app /v2 path (other than Support itself) is
 * honoured, and anything else — a direct visit, a preferences redirect that
 * dropped the state, a tampered value — falls back to Profile.
 */
export const SUPPORT_BACK_FALLBACK = '/v2/profile';
const SAFE_IN_APP_PATH = /^\/v2\/[A-Za-z0-9][A-Za-z0-9/_-]*$/;

export function supportBackTarget(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  if (typeof from !== 'string' || !SAFE_IN_APP_PATH.test(from)) return SUPPORT_BACK_FALLBACK;
  if (from === '/v2/support' || from.startsWith('/v2/support/')) return SUPPORT_BACK_FALLBACK;
  return from;
}
