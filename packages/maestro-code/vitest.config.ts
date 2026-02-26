import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // PTY-based visual tests (visual-gate, smoke-capture) are excluded from
    // default run via the test:visual script pattern. The default `npx vitest run`
    // runs all tests but visual tests will be skipped if node-pty is unavailable.
    // Run visual tests specifically: npm run test:visual
    testTimeout: 10000,
    // Cleanup ink instances after each test
    restoreMocks: true,
  },
});
