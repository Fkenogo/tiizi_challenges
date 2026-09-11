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

// Local Founder Preview only. Default OFF: production and normal local dev
// (against the real Firebase project) are unaffected. Never enabled unless
// VITE_USE_FIREBASE_EMULATORS is explicitly set.
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  const authHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9399';
  const [firestoreHost, firestorePort] = (
    import.meta.env.VITE_FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8092'
  ).split(':');
  connectAuthEmulator(getAuth(app), `http://${authHost}`, { disableWarnings: true });
  connectFirestoreEmulator(getFirestore(app), firestoreHost, Number(firestorePort));
}
