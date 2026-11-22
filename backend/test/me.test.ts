import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* GET /api/me/summary (MW_003 B2) + the customer auth middleware. Supabase is mocked. */

type User = { id: string; email: string; app_metadata: Record<string, unknown> };
const state = {
  users: {} as Record<string, User>, // access token → user
  profile: { first_name: 'Wafaa', gender: 'female', email_verified_at: '2026-11-20' } as Record<
    string,
    unknown
  >,
  balance: null as number | null,
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
          : { data: state.balance === null ? null : { balance: state.balance }, error: null };
      const builder = {
        select: () => builder,
        eq: () => builder,
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
  state.users = {
    'customer-token': { id: 'cus-1', email: 'w@example.com', app_metadata: { role: 'customer' } },
    'company-token': { id: 'co-1', email: 'c@example.com', app_metadata: { role: 'company' } },
  };
  state.profile = { first_name: 'Wafaa', gender: 'female', email_verified_at: '2026-11-20' };
  state.balance = 3;
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
  it('first name, gender, balance "X of 5" and the drafts (empty until B3)', async () => {
    const res = await summary('customer-token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      data: {
        firstName: 'Wafaa',
        gender: 'female',
        balance: { remaining: 3, total: 5 },
        drafts: [],
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
