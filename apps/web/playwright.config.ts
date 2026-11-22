import { defineConfig, devices } from '@playwright/test';

/**
 * E2E for the critical flows (spec 8.1). Runs the production build with the API and
 * Supabase mocked at the network layer (e2e/mocks.ts), so no real credentials are needed.
 * The customer portal (MW_002 Part B) runs on a second build with the MSW mocks enabled,
 * exactly like the deployed preview (decision 17).
 */
// With MSW on, requests the mocks don't handle (Supabase) are sent by the service worker:
// Chromium only lets context.route() see those with this flag (e2e/mocks.ts mockSupabase).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

const PORT = 4173;
const PORTAL_PORT = 4174;

const env = {
  VITE_API_URL: 'http://api.test',
  VITE_SUPABASE_URL: 'http://supabase.test',
  VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
};
const desktop = { ...devices['Desktop Chrome'] };
const mobile = { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } };

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', testIgnore: /portal.spec/, use: desktop },
    { name: 'mobile', testIgnore: /portal.spec/, use: mobile },
    {
      name: 'portal-desktop',
      testMatch: /portal.spec/,
      use: { ...desktop, baseURL: `http://localhost:${PORTAL_PORT}` },
    },
    {
      name: 'portal-mobile',
      testMatch: /portal.spec/,
      use: { ...mobile, baseURL: `http://localhost:${PORTAL_PORT}` },
    },
  ],
  // always build fresh: reusing a leftover preview silently tests a stale build
  webServer: [
    {
      command: `npx vite build --outDir dist-e2e --mode e2e && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { ...env, VITE_USE_MOCKS: 'false' },
    },
    {
      command: `npx vite build --outDir dist-e2e-portal --mode e2e && npx vite preview --outDir dist-e2e-portal --port ${PORTAL_PORT} --strictPort`,
      url: `http://localhost:${PORTAL_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { ...env, VITE_USE_MOCKS: 'true' },
    },
  ],
});
