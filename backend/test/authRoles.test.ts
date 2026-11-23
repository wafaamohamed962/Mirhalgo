import { beforeEach, describe, expect, it, vi } from 'vitest';

/* MW_002 changes in the auth service: role on login, company verification, decisions 2 + 8. */

const state = {
  profile: null as null | {
    id: string;
    email: string;
    role: string;
    email_verified_at: string | null;
  },
  signIn: { data: { session: null, user: null }, error: null } as { data: unknown; error: unknown },
};
const calls = {
  confirmEmail: vi.fn(),
  revokeSessions: vi.fn(),
  setPassword: vi.fn(),
  createCustomer: vi.fn(),
  refreshUnverifiedCustomer: vi.fn(),
  complete: vi.fn(async () => ({ referenceNumber: 'MG-C-2026-000001', status: 'pending_review' })),
  grant: vi.fn(async (_id: string) => 5),
};

vi.mock('../src/lib/supabase.js', () => ({
  createSignInClient: () => ({ auth: { signInWithPassword: async () => state.signIn } }),
}));
vi.mock('../src/services/users.js', () => ({
  findProfileByEmail: async () => state.profile,
  findProfileByPhone: async () => null,
  confirmEmail: calls.confirmEmail,
  revokeSessions: calls.revokeSessions,
  setPassword: calls.setPassword,
  createCustomer: calls.createCustomer,
  refreshUnverifiedCustomer: calls.refreshUnverifiedCustomer,
}));
vi.mock('../src/services/otp.js', () => ({
  otpSentResult: (email: string) => ({ email, cooldownSeconds: 60 }),
  issueOtp: vi.fn(),
  verifyOtp: async () => 'user-1',
}));
vi.mock('../src/services/companies.js', () => ({ completeCompanyVerification: calls.complete }));
vi.mock('../src/services/balance.js', () => ({ grantInitialBalance: calls.grant }));
vi.mock('../src/services/mail/index.js', () => ({
  assertMailConfigured: () => {},
  mail: { accountExists: vi.fn(), phoneTaken: vi.fn() },
}));
vi.spyOn(console, 'log').mockImplementation(() => {});

const auth = await import('../src/services/auth.js');

const session = { access_token: 'a', refresh_token: 'r' };
const signedIn = (appMetadata: Record<string, unknown>) => ({
  data: { session, user: { id: 'user-1', app_metadata: appMetadata } },
  error: null,
});
const identifier = { type: 'email' as const, value: 'ops@nile.com' };

beforeEach(() => {
  state.profile = null;
  vi.clearAllMocks();
});

describe('login role (decision 3)', () => {
  it('returns the role from app_metadata', async () => {
    state.signIn = signedIn({ role: 'company' });
    expect(await auth.login({ identifier, password: 'x' }, {})).toEqual({
      status: 'authenticated',
      session,
      role: 'company',
    });
  });

  it('falls back to the profile mirror, and refuses a user without any role', async () => {
    state.signIn = signedIn({ role: 'superuser' });
    state.profile = {
      id: 'user-1',
      email: 'ops@nile.com',
      role: 'customer',
      email_verified_at: 'x',
    };
    expect(await auth.login({ identifier, password: 'x' }, {})).toMatchObject({ role: 'customer' });

    state.profile = null;
    await expect(auth.login({ identifier, password: 'x' }, {})).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });
});

describe('verifyEmail', () => {
  it('customer: confirms the email', async () => {
    state.profile = { id: 'user-1', email: 'a@b.com', role: 'customer', email_verified_at: null };
    expect(await auth.verifyEmail({ email: 'a@b.com', code: '123456' }, {})).toEqual({
      verified: true,
      role: 'customer',
    });
    expect(calls.complete).not.toHaveBeenCalled();
    expect(calls.confirmEmail).toHaveBeenCalledWith('user-1');
    expect(calls.grant).toHaveBeenCalledWith('user-1', undefined); // 5 requests (MW_003 B7)
  });

  it('customer: a failed balance grant never fails the verification (summary retries it)', async () => {
    state.profile = { id: 'user-1', email: 'a@b.com', role: 'customer', email_verified_at: null };
    calls.grant.mockRejectedValueOnce(new Error('db down'));
    expect(await auth.verifyEmail({ email: 'a@b.com', code: '123456' }, {})).toEqual({
      verified: true,
      role: 'customer',
    });
    expect(calls.confirmEmail).toHaveBeenCalled();
  });

  it('company: moves the application first, then confirms; returns the reference', async () => {
    state.profile = {
      id: 'user-1',
      email: 'ops@nile.com',
      role: 'company',
      email_verified_at: null,
    };
    const order: string[] = [];
    calls.complete.mockImplementationOnce(async () => {
      order.push('application');
      return { referenceNumber: 'MG-C-2026-000001', status: 'pending_review' };
    });
    calls.confirmEmail.mockImplementationOnce(async () => void order.push('email'));
    expect(await auth.verifyEmail({ email: 'ops@nile.com', code: '123456' }, {})).toEqual({
      verified: true,
      role: 'company',
      application: { referenceNumber: 'MG-C-2026-000001', status: 'pending_review' },
    });
    expect(order).toEqual(['application', 'email']);
    expect(calls.grant).not.toHaveBeenCalled(); // companies have no request balance
  });
});

describe('customer signup vs an unverified company (decision 2)', () => {
  it('leaves the company application untouched and answers neutrally', async () => {
    state.profile = { id: 'co-1', email: 'ops@nile.com', role: 'company', email_verified_at: null };
    const result = await auth.signup(
      {
        firstName: 'Ali',
        lastName: 'Omar',
        email: 'ops@nile.com',
        phone: '+201012345678',
        gender: 'male',
        password: 'Str0ng!pass',
        confirmPassword: 'Str0ng!pass',
        acceptTerms: true,
      },
      {},
    );
    expect(result).toEqual({ email: 'ops@nile.com', cooldownSeconds: 60 });
    expect(calls.refreshUnverifiedCustomer).not.toHaveBeenCalled();
    expect(calls.createCustomer).not.toHaveBeenCalled();
  });
});

describe('resetPassword (decision 8)', () => {
  it('signs out every session after changing the password', async () => {
    await auth.resetPassword(
      { email: 'a@b.com', code: '123456', password: 'N3w!pass', confirmPassword: 'N3w!pass' },
      {},
    );
    expect(calls.setPassword).toHaveBeenCalledWith('user-1', 'N3w!pass');
    expect(calls.revokeSessions).toHaveBeenCalledWith('user-1');
  });
});
