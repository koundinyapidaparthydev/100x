import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const AUTH_SESSION_SECRET = 'aplifyai-e2e-session-secret-32b-min';
/** Dedicated ports avoid colliding with local :3000/:4000 apps (reuseExistingServer pitfall). */
const BACKEND_PORT = process.env.E2E_BACKEND_PORT ?? '4100';
const WEB_PORT = process.env.E2E_WEB_PORT ?? '3100';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${WEB_PORT}`;
const reuse = process.env.PW_REUSE_SERVER === '1';

/**
 * Production-critical Playwright config for the AplifyAI web control plane.
 * Starts backend (in-memory seed) + Vite web unless PW_REUSE_SERVER=1.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `npm run start -w aplifyai-backend`,
      cwd: REPO_ROOT,
      url: `http://127.0.0.1:${BACKEND_PORT}/api/v1/health`,
      reuseExistingServer: reuse,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: BACKEND_PORT,
        AUTH_SESSION_SECRET,
        AUTH_ALLOW_DEMO_LOGIN: '1',
        // Force in-memory seed so E2E is deterministic (no PERSIST file / DATABASE_URL).
        PERSIST: '0',
        DATA_DIR: '',
        DATABASE_URL: '',
        NODE_ENV: 'development',
      },
    },
    {
      command: `npm run dev -w aplifyai-web -- --port=${WEB_PORT} --host=127.0.0.1`,
      cwd: REPO_ROOT,
      url: BASE_URL,
      reuseExistingServer: reuse,
      timeout: 120_000,
      env: {
        ...process.env,
        WEB_PORT,
        DISABLE_HMR: 'true',
        API_PROXY_TARGET: `http://127.0.0.1:${BACKEND_PORT}`,
      },
    },
  ],
});
