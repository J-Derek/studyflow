import { defineConfig } from 'vitest/config';

// Rules tests need the Firestore emulator; run via `npm run test:rules`.
export default defineConfig({
  test: {
    include: ['rules-tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false
  }
});
