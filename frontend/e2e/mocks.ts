import type { Page, Route } from '@playwright/test';
import { referenceResponse } from '../test/referenceFixtures';

/** Network mocks for the API (http://api.test) and Supabase (http://supabase.test). */

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

export const USER = { id: 'user-1', email: 'ali@example.com', firstName: 'Ali' };

/** Unsigned JWT that supabase-js can decode (it only reads `exp` / `sub` client-side). */
export const ACCESS_TOKEN = [
  base64url({ alg: 'HS256', typ: 'JWT' }),
  base64url({
    sub: USER.id,
    email: USER.email,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { role: 'customer' },
    exp: Math.floor(Date.now() / 1000) + 24 * 3600,
  }),
  Buffer.from('test-signature').toString('base64url'),
].join('.');

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
    body: JSON.stringify(body),
  });

export const ok = (data: unknown) => ({ ok: true, data });
export const fail = (code: string) => ({ ok: false, error: { code, message: code } });

export type ApiHandler = (body: Record<string, unknown>) => { status: number; body: unknown };

/**
 * Mocks POST /api/<path>. Returns the list of request bodies for assertions. The public
 * reference lists (GET /api/reference/*, MW_003) always answer from the test fixtures.
 */
export async function mockApi(page: Page, handlers: Record<string, ApiHandler>) {
  const calls: Array<{ path: string; body: Record<string, unknown>; raw: string }> = [];
  await page.route('http://api.test/api/**', async (route) => {
    if (route.request().method() === 'OPTIONS') return json(route, 204, {});
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api', '');
    if (path.startsWith('/reference/')) {
      const list = referenceResponse(path.slice('/reference/'.length), url.searchParams);
      return list ? json(route, 200, ok(list)) : json(route, 404, fail('NOT_FOUND'));
    }
    const raw = route.request().postData() ?? '';
    let body: Record<string, unknown> = {};
    try {
      body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    } catch {
      // multipart (company registration): assert on `raw`
    }
    calls.push({ path, body, raw });
    const handler = handlers[path];
    if (!handler) return json(route, 404, fail('NOT_FOUND'));
    const result = handler(body);
    return json(route, result.status, result.body);
  });
  return calls;
}

/** The logged-in user's own profiles row, as PostgREST returns it (`.single()`). */
export const PROFILE_ROW = {
  id: USER.id,
  first_name: USER.firstName,
  last_name: 'Omar',
  gender: 'male',
  email: USER.email,
  phone: '+201012345678',
};

/** Minimal Supabase Auth + PostgREST for a verified, logged-in user. */
export async function mockSupabase(page: Page) {
  await page.context().route('http://supabase.test/**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'OPTIONS') return json(route, 204, {});
    if (url.pathname === '/auth/v1/user') {
      return json(route, 200, {
        id: USER.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: USER.email,
        email_confirmed_at: '2026-01-01T00:00:00Z',
        app_metadata: { role: 'customer' },
        user_metadata: {},
        created_at: '2026-01-01T00:00:00Z',
      });
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    // the portal reads (and updates) the user's own row: identity is real, not MSW (MW_002)
    if (url.pathname === '/rest/v1/profiles') return json(route, 200, PROFILE_ROW);
    return json(route, 404, {});
  });
}

export const loginSuccess: ApiHandler = () => ({
  status: 200,
  body: ok({
    status: 'authenticated',
    session: { access_token: ACCESS_TOKEN, refresh_token: 'refresh-token' },
    role: 'customer',
  }),
});

/** GET /api/me for the customer portal (the portal's other data is not mocked here). */
/** GET /me/summary (real API since MW_003 B2): welcome name, balance, no drafts. */
export const summary: ApiHandler = () => ({
  status: 200,
  body: ok({
    firstName: USER.firstName,
    gender: 'male',
    balance: { remaining: 5, total: 5 },
    drafts: [],
  }),
});

export const me: ApiHandler = () => ({
  status: 200,
  body: ok({
    id: USER.id,
    firstName: USER.firstName,
    lastName: 'Omar',
    gender: 'male',
    email: USER.email,
    phone: '+201012345678',
    avatarUrl: null,
  }),
});

/** A stored supabase-js session (no network needed while it is valid): logged-in customer. */
export async function seedCustomerSession(page: Page) {
  const session = {
    access_token: ACCESS_TOKEN,
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    expires_in: 24 * 3600,
    expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
    user: {
      id: USER.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: USER.email,
      email_confirmed_at: '2026-01-01T00:00:00Z',
      app_metadata: { role: 'customer' },
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  };
  await page.addInitScript(
    (value) => localStorage.setItem('mirhalgo.auth', value),
    JSON.stringify(session),
  );
}

export const otpSent: ApiHandler = (body) => ({
  status: 200,
  body: ok({ email: body.email, cooldownSeconds: 60 }),
});

/** Open the app in a given language (stored like the LanguageSwitch does). */
export async function setLanguage(page: Page, language: 'ar' | 'en') {
  await page.addInitScript((lang) => localStorage.setItem('mirhalgo.lang', lang), language);
}

/** What the New Request forms sent to the (mocked) real API, for assertions. */
export type PortalApiState = {
  balance: { remaining: number; total: number };
  drafts: Array<{ service: string; updatedAt: string }>;
  savedDrafts: Record<string, unknown>;
  uploads: Array<{ id: string; purpose: string; name: string }>;
  orders: Array<{ key: string | undefined; body: Record<string, unknown> }>;
  /** GET /orders/:reference (success page, B6). */
  records: Record<string, Record<string, unknown>>;
};

/**
 * The REAL API parts of the portal (MW_003 B2+: GET /me/summary, reference lists, server
 * drafts, uploads, orders). With MSW on they pass through the service worker, so they are
 * routed at the context level.
 */
export async function mockPortalApi(
  page: Page,
  { remaining = 3, drafts = true }: { remaining?: number; drafts?: boolean } = {},
) {
  const state: PortalApiState = {
    balance: { remaining, total: 5 },
    drafts: drafts
      ? [{ service: 'international', updatedAt: new Date(Date.now() - 7_200_000).toISOString() }]
      : [],
    savedDrafts: {},
    uploads: [],
    orders: [],
    records: {},
  };
  await page.context().route('http://api.test/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    const method = request.method();
    if (method === 'OPTIONS') return json(route, 204, {});
    if (method === 'GET' && pathname === '/api/me/summary') {
      return json(
        route,
        200,
        ok({
          firstName: USER.firstName,
          gender: 'male',
          balance: state.balance,
          drafts: state.drafts,
        }),
      );
    }
    if (method === 'GET' && pathname.startsWith('/api/reference/')) {
      const list = referenceResponse(pathname.slice('/api/reference/'.length), url.searchParams);
      return list ? json(route, 200, ok(list)) : json(route, 404, fail('NOT_FOUND'));
    }
    const draft = /^\/api\/orders\/drafts\/(\w+)$/.exec(pathname);
    if (draft) {
      const service = draft[1]!;
      if (method === 'GET') return json(route, 200, ok(state.savedDrafts[service] ?? null));
      if (method === 'PUT') {
        const saved = {
          ...request.postDataJSON(),
          uploads: [],
          updatedAt: new Date().toISOString(),
        };
        state.savedDrafts[service] = saved;
        return json(route, 200, ok(saved));
      }
      delete state.savedDrafts[service];
      state.drafts = state.drafts.filter((d) => d.service !== service);
      return json(route, 200, ok(null));
    }
    if (method === 'POST' && pathname === '/api/uploads') {
      const raw = request.postDataBuffer()?.toString('latin1') ?? '';
      const upload = {
        id: crypto.randomUUID(),
        purpose: /name="purpose"\r\n\r\n(\w+)/.exec(raw)?.[1] ?? 'document',
        name: /filename="([^"]+)"/.exec(raw)?.[1] ?? 'file',
        mime: 'application/pdf',
        size: 13,
        createdAt: new Date().toISOString(),
      };
      state.uploads.push(upload);
      return json(route, 201, ok(upload));
    }
    if (method === 'DELETE' && pathname.startsWith('/api/uploads/'))
      return json(route, 200, ok(null));
    if (method === 'POST' && pathname === '/api/orders') {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.orders.push({ key: request.headers()['idempotency-key'], body });
      if (state.balance.remaining === 0) return json(route, 409, fail('NO_BALANCE'));
      state.balance = { ...state.balance, remaining: state.balance.remaining - 1 };
      delete state.savedDrafts[String(body.service)]; // submit_order deletes the draft (B4)
      const reference = `MG${1000 + state.orders.length}`;
      state.records[reference] = {
        reference,
        service: body.service,
        status: 'under_review',
        submittedAt: new Date().toISOString(),
        order: body,
        derived: { items: [], totalContainers: null, totalTrucks: null, totalCbm: null },
        attachments: [],
      };
      return json(
        route,
        201,
        ok({
          reference,
          service: body.service,
          status: 'under_review',
          createdAt: new Date().toISOString(),
          balance: state.balance,
          replayed: false,
        }),
      );
    }
    const record = /^\/api\/orders\/(MG\d+)$/.exec(pathname);
    if (method === 'GET' && record) {
      const found = state.records[record[1]!];
      return found ? json(route, 200, ok(found)) : json(route, 404, fail('NOT_FOUND'));
    }
    return route.fallback();
  });
  return state;
}
