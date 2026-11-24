import { StrictMode, type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, Navigate, RouterProvider } from 'react-router';
import { setupServer } from 'msw/node';
import type { Session } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { Toaster } from '../../src/components/ui/Toast';
import { AuthContext, type AuthContextValue } from '../../src/features/auth/authContext';
import { CompanyLayout } from '../../src/features/companyPortal/layout/CompanyLayout';
import SectionPage from '../../src/features/companyPortal/pages/SectionPage';
import { createCompanyStore, type KeyValueStorage } from '../../src/mocks/company/db';
import { createCompanyHandlers } from '../../src/mocks/company/handlers';

/*
 * Company portal test harness (MW_004 B2+): the real layout and pages over the company mock
 * API (latency 0), like the customer portal's renderPortal.
 */

export const ACCOUNT_ID = 'company-a';
export const server = setupServer();

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
/** A JWT-shaped token: the mock reads `sub` and the role (no signature check). */
const ACCESS_TOKEN = [
  b64({ alg: 'none' }),
  b64({ sub: ACCOUNT_ID, email: 'demo.company@mirhalgo.com', app_metadata: { role: 'company' } }),
  'sig',
].join('.');

/** In-memory localStorage stand-in for the mock state (the page's localStorage stays free). */
export function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/** Fresh mock state for each test. */
export function resetCompanyMocks() {
  server.resetHandlers(
    ...createCompanyHandlers(createCompanyStore(memoryStorage()), { latency: 0 }),
  );
}

/** A stored supabase-js session, so apiRequest sends the company's Bearer token. */
function seedSession() {
  localStorage.setItem(
    'mirhalgo.auth',
    JSON.stringify({
      access_token: ACCESS_TOKEN,
      refresh_token: 'test-refresh-token',
      token_type: 'bearer',
      expires_in: 86_400,
      expires_at: Math.floor(Date.now() / 1000) + 86_400,
      user: { id: ACCOUNT_ID, aud: 'authenticated', email: 'demo.company@mirhalgo.com' },
    }),
  );
}

export const signOut = vi.fn(async () => {});

const company: AuthContextValue = {
  session: { user: { id: ACCOUNT_ID, email_confirmed_at: 'now' } } as unknown as Session,
  loading: false,
  isVerified: true,
  role: 'company',
  companyStatus: 'approved',
  signIn: async () => {},
  signOut,
  signedOut: false,
};

const SECTIONS = ['overview', 'requests', 'offers', 'competitors', 'inquiries', 'settings'];

/** The company portal at `path`; `pages` replaces a section's placeholder with its page. */
export function renderCompany(path: string, pages: Record<string, ReactNode> = {}) {
  seedSession();
  const router = createMemoryRouter(
    [
      {
        path: '/company',
        element: <CompanyLayout />,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          ...SECTIONS.map((section) => ({
            path: section,
            element: pages[section] ?? <SectionPage />,
            handle: { title: section },
          })),
        ],
      },
    ],
    { initialEntries: [path] },
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={company}>
          <RouterProvider router={router} />
          <Toaster />
        </AuthContext.Provider>
      </QueryClientProvider>
    </StrictMode>,
  );
  return router;
}
