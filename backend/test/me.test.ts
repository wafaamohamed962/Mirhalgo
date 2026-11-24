import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * GET /api/me (MW_004 A1), GET /api/me/summary (MW_003 B2) and the auth middleware.
 * Supabase is mocked.
 */

type User = {
  id: string;
  email: string;
  email_confirmed_at?: string;
  app_metadata: Record<string, unknown>;
};
const state = {
  users: {} as Record<string, User>, // access token → user
  profile: { first_name: 'Wafaa', gender: 'female', email_verified_at: '2026-11-20' } as Record<
    string,
    unknown
  >,
  balance: null as number | null,
  drafts: [] as Array<{ service: string; updated_at: string }>,
  application: null as { status: string } | null,
};
const calls = { grant: vi.fn() };

vi.mock('../src/lib/supabase.js', () => ({
  db: {
    auth: {
      getUser: async (token: string) =>
        state.users[token]
          ? { data: { user: state.users[token] }, error: null }
          : { data: { user: null }, error: new Error('invalid JWT') },
    },
    from: (table: string) => {
      const result =
        table === 'profiles'
          ? { data: state.profile, error: null }
          : table === 'order_drafts'
            ? { data: state.drafts, error: null }
            : table === 'company_applications'
              ? { data: state.application, error: null }
              : { data: state.balance === null ? null : { balance: state.balance }, error: null };
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
        single: async () => result,
        maybeSingle: async () => result,
      };
      return builder;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.grant(name, args);
      state.balance = 5;
      return { data: 5, error: null };
    },
  },
}));
vi.spyOn(console, 'log').mockImplementation(() => {});

const { createApp } = await import('../src/app.js');
const app = createApp();
const summary = (token?: string) => {
  const req = request(app).get('/api/me/summary');
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

beforeEach(() => {
  const confirmed = '2026-11-20T10:00:00Z';
  state.users = {
    'customer-token': {
      id: 'cus-1',
      email: 'w@example.com',
      email_confirmed_at: confirmed,
      app_metadata: { role: 'customer' },
    },
    'company-token': {
      id: 'co-1',
      email: 'c@example.com',
      email_confirmed_at: confirmed,
      app_metadata: { role: 'company' },
    },
    'no-role-token': { id: 'x-1', email: 'x@example.com', app_metadata: {} },
  };
  state.application = { status: 'approved' };
  state.profile = { first_name: 'Wafaa', gender: 'female', email_verified_at: '2026-11-20' };
  state.balance = 3;
  state.drafts = [{ service: 'china', updated_at: '2026-11-22T10:00:00Z' }];
  calls.grant.mockClear();
});

describe('requireCustomer', () => {
  it('401 UNAUTHORIZED without a token, with a bad header or an invalid / revoked token', async () => {
    for (const res of [
      await summary(),
      await request(app).get('/api/me/summary').set('Authorization', 'Basic abc'),
      await summary('expired-token'),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
  });

  it('403 FORBIDDEN for a company account (role from app_metadata)', async () => {
    const res = await summary('company-token');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('GET /api/me/summary', () => {
  it('first name, gender, balance "X of 5" and the saved drafts', async () => {
    const res = await summary('customer-token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      data: {
        firstName: 'Wafaa',
        gender: 'female',
        balance: { remaining: 3, total: 5 },
        drafts: [{ service: 'china', updatedAt: '2026-11-22T10:00:00Z' }],
      },
    });
    expect(calls.grant).not.toHaveBeenCalled();
  });

  it('verified customer without a balance row: the idempotent initial grant runs once', async () => {
    state.balance = null;
    const res = await summary('customer-token');
    expect(res.body.data.balance).toEqual({ remaining: 5, total: 5 });
    expect(calls.grant).toHaveBeenCalledWith('grant_balance', {
      p_customer_id: 'cus-1',
      p_amount: 5,
      p_reason: 'initial_grant',
      p_unique_key: 'initial:cus-1',
    });
  });

  it('unverified customer: 0 and no grant', async () => {
    state.balance = null;
    state.profile = { ...state.profile, email_verified_at: null };
    const res = await summary('customer-token');
    expect(res.body.data.balance).toEqual({ remaining: 0, total: 5 });
    expect(calls.grant).not.toHaveBeenCalled();
  });
});

describe('GET /api/me (MW_004 A1)', () => {
  const me = (token?: string) => {
    const req = request(app).get('/api/me');
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  it('401 without a valid token; 403 for a user without a known role', async () => {
    expect((await me()).status).toBe(401);
    expect((await me('expired-token')).status).toBe(401);
    expect((await me('no-role-token')).body.error.code).toBe('FORBIDDEN');
  });

  it('customer: role, no company status', async () => {
    const res = await me('customer-token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      data: { id: 'cus-1', role: 'customer', emailVerified: true, companyStatus: null },
    });
  });

  it.each(['approved', 'pending_review', 'changes_requested', 'rejected'])(
    'company: its application status from the DB (%s)',
    async (status) => {
      state.application = { status };
      const res = await me('company-token');
      expect(res.body.data).toEqual({
        id: 'co-1',
        role: 'company',
        emailVerified: true,
        companyStatus: status,
      });
    },
  );

  it('company without an application row: null (the client treats it as not approved)', async () => {
    state.application = null;
    expect((await me('company-token')).body.data.companyStatus).toBeNull();
  });
});
