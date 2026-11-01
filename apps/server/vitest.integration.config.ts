import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/tests/**/*.test.ts'],
    // Boot the server once, in-process, so roomStore.clear() and rate-limit
    // state are shared with the tests, and so the real 30s host-promotion
    // wait fits inside the per-test timeout.
    setupFiles: ['./src/tests/setup-server.ts'],
    fileParallelism: false,
    isolate: false,
    testTimeout: 45000,
    hookTimeout: 15000,
  },
});
