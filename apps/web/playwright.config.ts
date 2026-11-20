import { defineConfig, devices } from '@playwright/test';

/**
 * E2E for the critical flows (spec 8.1). Runs the production build with the API and
 * Supabase mocked at the network layer (e2e/mocks.ts), so no real credentials are needed.
 */
const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } } },
  ],
  webServer: {
    command: `npx vite build --outDir dist-e2e --mode e2e && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // always build fresh: reusing a leftover preview silently tests a stale build
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      VITE_API_URL: 'http://api.test',
      VITE_SUPABASE_URL: 'http://supabase.test',
      VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
    },
  },
});
