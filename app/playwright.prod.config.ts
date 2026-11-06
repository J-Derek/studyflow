import { defineConfig } from '@playwright/test';

// Runs a few checks against the PRODUCTION build (minified, with Vite's preload helper), which behaves
// differently from the dev server used by the main suite. See `npm run test:e2e:prod`.
export default defineConfig({
  testDir: './e2e-prod',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: { baseURL: 'http://127.0.0.1:5198', trace: 'retain-on-failure' },
  webServer: {
    command: 'npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port 5198 --host 127.0.0.1 --strictPort',
    url: 'http://127.0.0.1:5198',
    reuseExistingServer: false,
    env: { VITE_USE_EMULATORS: 'true', VITE_FIREBASE_PROJECT_ID: 'studyflow-e2e' },
    timeout: 120_000
  }
});
