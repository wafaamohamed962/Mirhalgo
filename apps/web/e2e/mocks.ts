import type { Page, Route } from '@playwright/test';

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

/** Mocks POST /api/<path>. Returns the list of request bodies for assertions. */
export async function mockApi(page: Page, handlers: Record<string, ApiHandler>) {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  await page.route('http://api.test/api/**', async (route) => {
    if (route.request().method() === 'OPTIONS') return json(route, 204, {});
    const path = new URL(route.request().url()).pathname.replace('/api', '');
    const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    calls.push({ path, body });
    const handler = handlers[path];
    if (!handler) return json(route, 404, fail('NOT_FOUND'));
    const result = handler(body);
    return json(route, result.status, result.body);
  });
  return calls;
}

/** Minimal Supabase Auth + PostgREST for a verified, logged-in user. */
export async function mockSupabase(page: Page) {
  await page.route('http://supabase.test/**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'OPTIONS') return json(route, 204, {});
    if (url.pathname === '/auth/v1/user') {
      return json(route, 200, {
        id: USER.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: USER.email,
        email_confirmed_at: '2026-01-01T00:00:00Z',
        app_metadata: {},
        user_metadata: {},
        created_at: '2026-01-01T00:00:00Z',
      });
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (url.pathname === '/rest/v1/profiles')
      return json(route, 200, { first_name: USER.firstName });
    return json(route, 404, {});
  });
}

export const loginSuccess: ApiHandler = () => ({
  status: 200,
  body: ok({
    status: 'authenticated',
    session: { access_token: ACCESS_TOKEN, refresh_token: 'refresh-token' },
  }),
});

export const otpSent: ApiHandler = (body) => ({
  status: 200,
  body: ok({ email: body.email, cooldownSeconds: 60 }),
});

/** Open the app in a given language (stored like the LanguageSwitch does). */
export async function setLanguage(page: Page, language: 'ar' | 'en') {
  await page.addInitScript((lang) => localStorage.setItem('mirhalgo.lang', lang), language);
}
