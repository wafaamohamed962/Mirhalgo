import { StrictMode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, Navigate, RouterProvider } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { Session } from '@supabase/supabase-js';
import {
  ORDER_REFERENCE_PATTERN,
  type MeSummary,
  type OrderDraft,
  type OrderRecord,
} from '@mirhalgo/shared';
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
import SupportPage from '../../src/features/portal/support/SupportPage';
import TicketPage from '../../src/features/portal/support/TicketPage';
import RequestFormPage from '../../src/features/requests/RequestFormPage';
import RequestSuccessPage from '../../src/features/requests/RequestSuccessPage';
import { createMockDb, type MockDb } from '../../src/mocks/db';
import { referenceResponse } from '../referenceFixtures';
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

/**
 * Stand-in for the REAL API parts of the portal (MW_003 B2+): GET /me/summary and draft discard.
 * They are not in src/mocks (those pass through to the server), so the tests answer them here.
 */
export let apiState: MeSummary;
/** Server drafts by service and the orders the forms submitted (with their Idempotency-Key). */
export let draftStore: Record<string, OrderDraft & { updatedAt: string; uploads: [] }>;
/** Orders the API knows (filled by submits, or planted by a test). */
export let orderRecords: Record<string, OrderRecord>;
export let submitted: Array<{ key: string | null; body: Record<string, unknown> }>;

const realApiHandlers = [
  http.get('*/api/me/summary', ({ request }) =>
    request.headers.get('authorization') === 'Bearer test-access-token'
      ? HttpResponse.json({ ok: true, data: apiState })
      : HttpResponse.json(
          { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 },
        ),
  ),
  http.get('*/api/reference/:list', ({ params, request }) => {
    const data = referenceResponse(String(params.list), new URL(request.url).searchParams);
    return HttpResponse.json({ ok: true, data: data ?? [] });
  }),
  http.get('*/api/orders/drafts/:service', ({ params }) =>
    HttpResponse.json({ ok: true, data: draftStore[String(params.service)] ?? null }),
  ),
  http.put('*/api/orders/drafts/:service', async ({ params, request }) => {
    const body = (await request.json()) as OrderDraft;
    draftStore[String(params.service)] = {
      ...body,
      updatedAt: new Date().toISOString(),
      uploads: [],
    };
    return HttpResponse.json({ ok: true, data: draftStore[String(params.service)] });
  }),
  http.post('*/api/orders', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    submitted.push({ key: request.headers.get('idempotency-key'), body });
    if (apiState.balance.remaining === 0)
      return HttpResponse.json(
        { ok: false, error: { code: 'NO_BALANCE', message: 'No balance' } },
        { status: 409 },
      );
    apiState.balance.remaining -= 1;
    const reference = `MG${1000 + submitted.length}`;
    // read back by the success page (GET /orders/:reference, B6)
    orderRecords[reference] = {
      reference,
      service: body.service as OrderRecord['service'],
      status: 'under_review',
      submittedAt: new Date().toISOString(),
      order: body,
      derived: { items: [], totalContainers: null, totalTrucks: null, totalCbm: null },
      attachments: [],
    };
    return HttpResponse.json(
      {
        ok: true,
        data: {
          reference,
          service: body.service,
          status: 'under_review',
          createdAt: new Date().toISOString(),
          balance: apiState.balance,
          replayed: false,
        },
      },
      { status: 201 },
    );
  }),
  http.delete('*/api/uploads/:id', () => HttpResponse.json({ ok: true, data: null })),
  http.get('*/api/orders/:reference', ({ params }) => {
    // mocked My Orders ids (ord_118) fall through to the MSW portal handlers
    if (!ORDER_REFERENCE_PATTERN.test(String(params.reference))) return undefined;
    const record = orderRecords[String(params.reference)];
    return record
      ? HttpResponse.json({ ok: true, data: record })
      : HttpResponse.json(
          { ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } },
          { status: 404 },
        );
  }),
  http.delete('*/api/orders/drafts/:service', ({ params }) => {
    delete draftStore[String(params.service)];
    apiState.drafts = apiState.drafts.filter((draft) => draft.service !== params.service);
    return HttpResponse.json({ ok: true, data: null });
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
  draftStore = {};
  submitted = [];
  orderRecords = {};
  apiState = {
    firstName: 'Wafaa',
    gender: 'female',
    balance: { remaining: 3, total: 5 },
    drafts: [
      { service: 'international', updatedAt: new Date(Date.now() - 7_200_000).toISOString() },
    ],
  };
  server.resetHandlers(
    ...supabaseHandlers,
    ...realApiHandlers,
    ...createHandlers(db, { latency: 0 }),
  );
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
          page('new-request/success/:reference', <RequestSuccessPage />, 'newRequest'),
          page('new-request/:service', <RequestFormPage />, 'newRequest'),
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
  // StrictMode like main.tsx: effects run twice in development (a min-1 list once got 2 rows)
  render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={customer}>
          <RouterProvider router={router} />
          <Toaster />
        </AuthContext.Provider>
      </QueryClientProvider>
    </StrictMode>,
  );
  return router;
}
