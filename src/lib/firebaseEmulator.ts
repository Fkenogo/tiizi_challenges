import { connectAuthEmulator, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, type Firestore } from 'firebase/firestore';

const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
const FIRESTORE_EMULATOR_HOST = '127.0.0.1';
const FIRESTORE_EMULATOR_PORT = 8080;

let configuredAuthClients = new WeakSet<object>();
let configuredFirestoreClients = new WeakSet<object>();

export function shouldUseFirebaseEmulators(rawFlag: string | undefined, isDevelopment: boolean): boolean {
  return isDevelopment && rawFlag?.trim().toLowerCase() === 'true';
}

/**
 * Connect initialized Firebase clients to the local preview emulators once.
 * Callers must gate this behind the explicit local preview flag; this helper
 * deliberately has no production endpoint fallback.
 */
export function configureFirebaseEmulators(auth: Auth, firestore: Firestore, enabled: boolean): void {
  if (!enabled) return;

  if (!configuredAuthClients.has(auth)) {
    connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
    configuredAuthClients.add(auth);
  }
  if (!configuredFirestoreClients.has(firestore)) {
    connectFirestoreEmulator(firestore, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
    configuredFirestoreClients.add(firestore);
  }
}

/** Test seam only; production clients remain process-singletons. */
export function resetFirebaseEmulatorConnectionsForTests(): void {
  configuredAuthClients = new WeakSet<object>();
  configuredFirestoreClients = new WeakSet<object>();
}
