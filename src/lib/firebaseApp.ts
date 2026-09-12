import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

/**
 * EBC-05 local Founder Preview identity seam. When
 * VITE_FIREBASE_USE_EMULATORS === 'true', Auth and Firestore point at the
 * local Firebase emulators (Auth emulator issues the ID tokens the local
 * Tiizi API verifies via FIREBASE_AUTH_EMULATOR_HOST). Default OFF:
 * production builds never touch emulators. Local-only, never deployed.
 */
const useEmulators =
  (import.meta.env.VITE_FIREBASE_USE_EMULATORS ?? '').trim().toLowerCase() === 'true';

export const auth = getAuth(app);
export const db = getFirestore(app);

if (useEmulators) {
  const authHost = (import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL ?? 'http://127.0.0.1:9099').trim();
  const firestoreHost = (import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST ?? '127.0.0.1').trim();
  const firestorePort = Number(import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT ?? 8080);
  connectAuthEmulator(auth, authHost, { disableWarnings: true });
  connectFirestoreEmulator(db, firestoreHost, Number.isFinite(firestorePort) ? firestorePort : 8080);
}

export function isFirebaseEmulatorPreview(): boolean {
  return useEmulators;
}
