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

const CONNECTED_KEY = '__tiiziAuthEmulatorConnected';

/**
 * Connect one Auth instance to the local emulator when emulator mode
 * is enabled. Safe under HMR/module reload: the connected marker
 * lives on globalThis, which survives module re-execution, so the
 * SDK is never connected twice. Returns true when emulator mode is
 * active (connected now or on an earlier pass).
 */
export function connectAuthEmulatorOnce(auth: Auth): boolean {
  if (!isAuthEmulatorModeEnabled()) return false;
  const scope = globalThis as unknown as Record<string, unknown>;
  if (scope[CONNECTED_KEY] === true) return true;
  connectAuthEmulator(auth, AUTH_EMULATOR_URL);
  scope[CONNECTED_KEY] = true;
  return true;
}
