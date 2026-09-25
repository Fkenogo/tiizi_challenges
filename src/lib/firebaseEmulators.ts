import { connectAuthEmulator, type Auth } from 'firebase/auth';

/**
 * TIIZI S1 CORR-002 — development-only Firebase Auth emulator mode.
 *
 * Neutral technical infrastructure (no Product Experience): lets the
 * local Founder preview authenticate against the already-running
 * local Auth emulator holding the seeded preview identities.
 *
 * Activation requires BOTH:
 * - a development runtime (import.meta.env.DEV), AND
 * - the explicit opt-in flag VITE_USE_FIREBASE_EMULATORS=true.
 *
 * Hostname sniffing is deliberately NOT used: serving from
 * localhost alone never enables emulator mode. Production builds
 * (DEV === false) can never activate it, and the default Firebase
 * behaviour is unchanged when the flag is absent.
 *
 * The emulator address is local technical configuration, not a
 * credential. No secrets are read or stored here.
 */

/** Local Auth emulator endpoint (Founder preview only). */
export const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';

/** import.meta.env shape needed here; kept minimal for testability. */
type EmulatorEnv = {
  DEV?: unknown;
  VITE_USE_FIREBASE_EMULATORS?: unknown;
  VITE_FIREBASE_AUTH_EMULATOR_URL?: unknown;
  [key: string]: unknown;
};

/**
 * Pure decision: should Firebase Auth connect to the local emulator?
 * True only for an explicit development opt-in. Extra fields (host,
 * hostname, ports) are ignored — they must never influence the result.
 */
export function resolveAuthEmulatorMode(env: EmulatorEnv): boolean {
  if (env.DEV !== true) return false;
  const flag = env.VITE_USE_FIREBASE_EMULATORS;
  return typeof flag === 'string' && flag.trim().toLowerCase() === 'true';
}

/** Reads the live Vite environment (single call site for the app). */
export function isAuthEmulatorModeEnabled(): boolean {
  const env = (import.meta as unknown as { env?: EmulatorEnv }).env;
  return resolveAuthEmulatorMode(env ?? {});
}

/** Allow isolated local previews on another loopback port without changing the shared Auth override. */
export function resolveAuthEmulatorUrl(env: EmulatorEnv): string {
  const raw = typeof env.VITE_FIREBASE_AUTH_EMULATOR_URL === 'string'
    ? env.VITE_FIREBASE_AUTH_EMULATOR_URL.trim()
    : '';
  if (!raw) return AUTH_EMULATOR_URL;
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Auth emulator URL must be a loopback HTTP URL.'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Auth emulator URL must be a loopback HTTP URL.');
  }
  return `${url.origin}`;
}

const CONNECTED_KEY = '__tiiziAuthEmulatorConnected';

/**
 * Connect one Auth instance to the local emulator when emulator mode
 * is enabled. Safe under HMR/module reload: the connected marker
 * lives on globalThis, which survives module re-execution, so the
 * SDK is never connected twice. Returns true when emulator mode is
 * active (connected now or on an earlier pass).
 *
 * `disableWarnings` is deliberate (TIIZI-MOBILE-PRIMARY-NAV-CORR-001):
 * the SDK's default emulator warning is a `position: fixed; bottom: 0;
 * z-index: 10000` banner injected into `document.body`, which occludes the
 * V2 member shell's mobile bottom navigation (Today / Challenges / Groups)
 * and leaves the Founder with no discoverable primary navigation on a
 * phone. Suppressing the SDK banner restores that existing approved mobile
 * navigation; the emulator binding is still announced through the
 * development-only console line below. This branch is unreachable in
 * production builds (DEV is statically false there).
 */
export function connectAuthEmulatorOnce(auth: Auth): boolean {
  if (!isAuthEmulatorModeEnabled()) return false;
  const scope = globalThis as unknown as Record<string, unknown>;
  if (scope[CONNECTED_KEY] === true) return true;
  const env = (import.meta as unknown as { env?: EmulatorEnv }).env ?? {};
  const emulatorUrl = resolveAuthEmulatorUrl(env);
  connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
  scope[CONNECTED_KEY] = true;
  // Development-only diagnostic so the Founder can observe the emulator
  // binding in the browser console. This branch is unreachable in
  // production builds (DEV is statically false there).
  console.info(`[tiizi] Auth emulator mode: connected to ${emulatorUrl} (development preview only)`);
  return true;
}
