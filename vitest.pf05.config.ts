/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

// PF-05 Wizard runtime tests only: node environment (no DOM), React
// test-renderer for real component rendering. Firebase env is stubbed to
// dummy values — auth identity is provided by directly setting the Auth
// singleton's currentUser in each test, and API transport by stubbing
// global fetch. No network, no emulator.
export default defineConfig({
  define: {
    'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify('pf05-test-key'),
    'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify('pf05-test.firebaseapp.com'),
    'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify('pf05-test'),
    'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify('pf05-test.firebasestorage.app'),
    'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify('000000000000'),
    'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify('1:000000000000:web:pf05test'),
    'import.meta.env.VITE_TIIZI_API_BASE_URL': JSON.stringify('http://localhost:4000'),
    'import.meta.env.VITE_TIIZI_V2_CHALLENGES_ENABLED': JSON.stringify('true'),
  },
  test: {
    environment: 'node',
    include: ['src/features/Challenges/V2/**/*.runtime.test.tsx'],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
