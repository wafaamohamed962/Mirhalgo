import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeResponse } from '@mirhalgo/shared';

/*
 * MW_004 A1: the company status behind the routing. From the login response when logging in,
 * from GET /api/me (once per account) when a stored session is opened. Customers never call it.
 */

const state = vi.hoisted(() => ({
  session: null as null | { user: Record<string, unknown> },
  me: vi.fn<() => Promise<MeResponse>>(),
}));

const sessionFor = (role: string, id = 'user-1') => ({
  access_token: 'a',
  refresh_token: 'r',
  user: { id, email_confirmed_at: 'now', app_metadata: { role } },
});

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: state.session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      setSession: async () => ({ data: { session: sessionFor('company', 'user-2') }, error: null }),
    },
  },
}));
vi.mock('../src/features/auth/api', () => ({ authApi: { me: state.me } }));

const { AuthProvider } = await import('../src/features/auth/AuthProvider');
const { useAuth } = await import('../src/features/auth/hooks/useAuth');

function Probe() {
  const { loading, role, companyStatus, signIn } = useAuth();
  return (
    <>
      <p>{loading ? 'loading' : `ready ${role ?? 'guest'} ${companyStatus ?? 'none'}`}</p>
      <button
        type="button"
        onClick={() => void signIn({ access_token: 'a', refresh_token: 'r' }, 'rejected')}
      >
        sign in
      </button>
    </>
  );
}

const renderProvider = () =>
  render(
    <StrictMode>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </StrictMode>,
  );

beforeEach(() => {
  state.me.mockReset();
  state.session = null;
});

describe('AuthProvider company status (MW_004 A1)', () => {
  it('a stored company session waits for GET /api/me, then routes by its status', async () => {
    state.session = sessionFor('company');
    let resolve!: (me: MeResponse) => void;
    state.me.mockReturnValue(new Promise((r) => (resolve = r)));
    renderProvider();
    // still loading while the status is unknown: guards must not route yet
    await waitFor(() => expect(state.me).toHaveBeenCalled());
    expect(screen.getByText('loading')).toBeInTheDocument();
    await act(async () =>
      resolve({ id: 'user-1', role: 'company', emailVerified: true, companyStatus: 'approved' }),
    );
    expect(await screen.findByText('ready company approved')).toBeInTheDocument();
  });

  it('a customer never calls GET /api/me', async () => {
    state.session = sessionFor('customer');
    renderProvider();
    expect(await screen.findByText('ready customer none')).toBeInTheDocument();
    expect(state.me).not.toHaveBeenCalled();
  });

  it('API unreachable: unknown status (the status page, never the portal)', async () => {
    state.session = sessionFor('company');
    state.me.mockRejectedValue(new Error('network'));
    renderProvider();
    expect(await screen.findByText('ready company none')).toBeInTheDocument();
  });

  it('login passes the status from its response: no extra request', async () => {
    renderProvider();
    expect(await screen.findByText('ready guest none')).toBeInTheDocument();
    await act(async () => screen.getByRole('button', { name: 'sign in' }).click());
    expect(await screen.findByText('ready company rejected')).toBeInTheDocument();
    expect(state.me).not.toHaveBeenCalled();
  });
});
