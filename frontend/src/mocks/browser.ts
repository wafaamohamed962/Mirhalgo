import { setupWorker } from 'msw/browser';
import { createMockDb } from './db';
import { createHandlers } from './handlers';

/**
 * Starts the MSW service worker for the customer portal (VITE_USE_MOCKS=true, decision 17).
 * Requests without a mock (auth, contact, company registration, Supabase) pass through.
 */
export function startMocks() {
  return setupWorker(...createHandlers(createMockDb())).start({
    onUnhandledFrame: 'bypass',
    quiet: true,
  });
}
