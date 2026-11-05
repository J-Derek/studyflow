import { defineConfig } from '@playwright/test';

// Runs against the Firebase Auth + Firestore emulators (see `npm run test:e2e`).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0, // one retry on CI only; a retried pass is reported as flaky
  // On GitHub, also emit annotations so failures are readable without downloading logs.
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: { baseURL: 'http://127.0.0.1:5199', trace: 'retain-on-failure' },
  webServer: {
    command: 'npx vite --port 5199 --host 127.0.0.1 --strictPort',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: false,
    env: { VITE_USE_EMULATORS: 'true', VITE_FIREBASE_PROJECT_ID: 'studyflow-e2e' },
    timeout: 60_000
  }
});
