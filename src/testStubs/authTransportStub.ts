// Vitest-only stand-in for the Firebase-backed auth transport module (see vite.config.ts `test.alias`).
// It lets the real API client run in jsdom with a fixed bearer and no Firebase initialisation.
export const auth = { currentUser: { getIdToken: async () => 'id-token-123' } };
