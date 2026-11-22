import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, Navigate, RouterProvider } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { Session } from '@supabase/supabase-js';
import { Toaster } from '../../src/components/ui/Toast';
import { AuthContext, type AuthContextValue } from '../../src/features/auth/authContext';
import AccountPage from '../../src/features/portal/account/AccountPage';
import CompaniesPage from '../../src/features/portal/companies/CompaniesPage';
import CompanyProfilePage from '../../src/features/portal/companies/CompanyProfilePage';
import { PortalLayout } from '../../src/features/portal/layout/PortalLayout';
import NotificationsPage from '../../src/features/portal/notifications/NotificationsPage';
import OrderDetailsPage from '../../src/features/portal/orders/OrderDetailsPage';
import OrdersPage from '../../src/features/portal/orders/OrdersPage';
import NewRequestPage from '../../src/features/portal/requests/NewRequestPage';
import ServicePlaceholderPage from '../../src/features/portal/requests/ServicePlaceholderPage';
import SupportPage from '../../src/features/portal/support/SupportPage';
import TicketPage from '../../src/features/portal/support/TicketPage';
import { createMockDb, type MockDb } from '../../src/mocks/db';
import { createHandlers } from '../../src/mocks/handlers';

/** One MSW server for the portal tests; each test gets a fresh mock db (see resetPortalDb). */
export const server = setupServer();
export let db: MockDb;

const USER_ID = 'cus_1';

/**
 * The logged-in user's REAL profiles row (Supabase, RLS): the portal identity comes from here,
 * not from the portal mocks. Deliberately a different name than the mock fixture.
 */
export let profileRow: Record<string, string>;

const PROFILES_URL = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles`;

const ownRow = (url: string) => new URL(url).searchParams.get('id') === `eq.${USER_ID}`;

const supabaseHandlers = [
  http.get(PROFILES_URL, ({ request }) =>
    ownRow(request.url) ? HttpResponse.json(profileRow) : new HttpResponse(null, { status: 406 }),
  ),
  http.patch(PROFILES_URL, async ({ request }) => {
    if (!ownRow(request.url)) return new HttpResponse(null, { status: 406 });
    Object.assign(profileRow, (await request.json()) as Record<string, string>);
    return HttpResponse.json(profileRow);
  }),
];

export function resetPortalDb() {
  db = createMockDb();
  profileRow = {
    id: USER_ID,
    first_name: 'Wafaa',
    last_name: 'Mohamed',
    gender: 'female',
    email: 'customer@example.com',
    phone: '+201098765432',
  };
  server.resetHandlers(...supabaseHandlers, ...createHandlers(db, { latency: 0 }));
}

/** A stored supabase-js session (valid for a day, so no network is needed to read it). */
function seedSession() {
  const user = { id: USER_ID, aud: 'authenticated', email: profileRow.email };
  localStorage.setItem(
    'mirhalgo.auth',
    JSON.stringify({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_type: 'bearer',
      expires_in: 86_400,
      expires_at: Math.floor(Date.now() / 1000) + 86_400,
      user,
    }),
  );
}

const customer: AuthContextValue = {
  session: { user: { id: USER_ID, email_confirmed_at: 'now' } } as unknown as Session,
  loading: false,
  isVerified: true,
  role: 'customer',
  signIn: async () => {},
  signOut: async () => {},
  signedOut: false,
};

const page = (path: string, element: React.ReactNode, title: string) => ({
  path,
  element,
  handle: { title },
});

/** Renders the portal (real layout + pages, mocked API) at `path`. */
export function renderPortal(path: string) {
  seedSession();
  const router = createMemoryRouter(
    [
      {
        path: '/app',
        element: <PortalLayout />,
        children: [
          { index: true, element: <Navigate to="new-request" replace /> },
          page('new-request', <NewRequestPage />, 'newRequest'),
          page('new-request/:service', <ServicePlaceholderPage />, 'newRequest'),
          page('orders', <OrdersPage />, 'orders'),
          page('orders/:id', <OrderDetailsPage />, 'portal.orders.detailTitle'),
          page('companies', <CompaniesPage />, 'companies'),
          page('companies/:id', <CompanyProfilePage />, 'portal.companies.profileTitle'),
          page('account/:section?', <AccountPage />, 'account'),
          page('notifications', <NotificationsPage />, 'notifications'),
          page('support', <SupportPage />, 'support'),
          page('support/tickets/:id', <TicketPage />, 'portal.support.ticketTitle'),
        ],
      },
    ],
    { initialEntries: [path] },
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={customer}>
        <RouterProvider router={router} />
        <Toaster />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return router;
}
