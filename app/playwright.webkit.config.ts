import { defineConfig, devices } from '@playwright/test';

// A short smoke run in Safari's engine (WebKit), on a laptop and on an iPhone-sized screen. The main suite runs in Chromium only,
// and Safari is where the pop-up sign-in, storage limits and timers behave differently, so the main paths are walked here too.
// Needs the browser once: `npx playwright install webkit`. Runs against the same emulators (see `npm run test:e2e:webkit`).
export default defineConfig({
  testDir: './e2e-webkit',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: { baseURL: 'http://127.0.0.1:5196', trace: 'retain-on-failure' },
  projects: [
    { name: 'safari-desktop', use: { ...devices['Desktop Safari'] } },
    { name: 'safari-iphone', use: { ...devices['iPhone 13'] } }
  ],
  webServer: {
    command: 'npx vite --port 5196 --host 127.0.0.1 --strictPort',
    url: 'http://127.0.0.1:5196',
    reuseExistingServer: false,
    env: { VITE_USE_EMULATORS: 'true', VITE_FIREBASE_PROJECT_ID: 'studyflow-e2e' },
    timeout: 60_000
  }
});
