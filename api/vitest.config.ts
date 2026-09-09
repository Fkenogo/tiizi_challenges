import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60000,
    // Each test file boots its own PGlite (WASM Postgres + migrations) in
    // beforeAll; under parallel load the boot can exceed vitest's 10s hook
    // default. Align hooks with the test timeout instead of flaking.
    hookTimeout: 60000,
    pool: 'forks',
  },
});
