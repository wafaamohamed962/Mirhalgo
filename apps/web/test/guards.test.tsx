import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import type { UserRole } from '@mirhalgo/shared';
import { AuthContext, type AuthContextValue } from '../src/features/auth/authContext';
import { GuestRoute, HomeRedirect, ProtectedRoute } from '../src/features/auth/guards';

const auth = (
  role: UserRole | null,
  { verified = true, signedOut = false } = {},
): AuthContextValue => ({
  session: verified ? ({ user: { email_confirmed_at: 'now' } } as unknown as Session) : null,
  loading: false,
  isVerified: verified,
  role,
  signIn: async () => {},
  signOut: async () => {},
  signedOut,
});

function renderAt(path: string, value: AuthContextValue) {
  const router = createMemoryRouter(
    [
      {
        element: <ProtectedRoute allow={['customer']} />,
        children: [{ path: '/app', element: <p>customer portal</p> }],
      },
      {
        element: <ProtectedRoute allow={['company']} />,
        children: [{ path: '/application-status', element: <p>company status</p> }],
      },
      {
        element: <ProtectedRoute />,
        children: [{ path: '/dashboard', element: <HomeRedirect /> }],
      },
      { element: <GuestRoute />, children: [{ path: '/login', element: <p>login</p> }] },
      { path: '/', element: <p>home</p> },
    ],
    { initialEntries: [path] },
  );
  render(
    <AuthContext.Provider value={value}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  );
}

describe('route guards (spec 4.5 + MW_002 A6)', () => {
  it('sends visitors without a verified session to /login', () => {
    renderAt('/app', auth(null, { verified: false }));
    expect(screen.getByText('login')).toBeInTheDocument();
  });

  it('after logout, protected pages send the user home, not to /login', () => {
    renderAt('/app', auth(null, { verified: false, signedOut: true }));
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('lets verified customers into the customer portal', () => {
    renderAt('/app', auth('customer'));
    expect(screen.getByText('customer portal')).toBeInTheDocument();
  });

  it('a company can never open the customer portal', () => {
    renderAt('/app', auth('company'));
    expect(screen.getByText('company status')).toBeInTheDocument();
  });

  it('a customer cannot open the company status page', () => {
    renderAt('/application-status', auth('customer'));
    expect(screen.getByText('customer portal')).toBeInTheDocument();
  });

  it('a session without a known role gets no portal', () => {
    renderAt('/app', auth(null));
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it.each([
    ['customer', 'customer portal'],
    ['company', 'company status'],
  ] as const)('/dashboard and /login send a logged-in %s to their home', (role, page) => {
    renderAt('/dashboard', auth(role));
    expect(screen.getByText(page)).toBeInTheDocument();
    document.body.innerHTML = '';
    renderAt('/login', auth(role));
    expect(screen.getByText(page)).toBeInTheDocument();
  });
});
