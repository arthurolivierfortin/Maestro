import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // ink-testing-library is ESM, vitest handles it natively
    testTimeout: 10000,
    // Cleanup ink instances after each test
    restoreMocks: true,
  },
});
