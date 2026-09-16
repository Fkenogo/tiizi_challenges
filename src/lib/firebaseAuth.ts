import { getAuth } from 'firebase/auth';
import { app } from './firebaseApp';
import { connectAuthEmulatorOnce } from './firebaseEmulators';

export const auth = getAuth(app);

// S1 CORR-002: development-only local Auth emulator wiring for Founder
// preview. No-op unless DEV + VITE_USE_FIREBASE_EMULATORS=true.
connectAuthEmulatorOnce(auth);
