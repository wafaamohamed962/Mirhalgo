import { setupWorker } from 'msw/browser';
import { createCompanyStore } from './company/db';
import { createCompanyHandlers } from './company/handlers';
import { createMockDb } from './db';
import { createHandlers } from './handlers';

/**
 * Starts the MSW service worker (VITE_USE_MOCKS=true, decision 17): the customer portal
 * (in memory) and the company portal (MW_004, persisted per account in localStorage).
 * Requests without a mock (auth, GET /me, contact, company registration, Supabase) pass
 * through.
 */
export function startMocks() {
  return setupWorker(
    ...createHandlers(createMockDb()),
    ...createCompanyHandlers(createCompanyStore()),
  ).start({
    onUnhandledFrame: 'bypass',
    quiet: true,
  });
}
