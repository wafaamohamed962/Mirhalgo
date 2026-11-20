import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { AuthContext, type AuthContextValue } from '../src/features/auth/authContext';
import { GuestRoute, ProtectedRoute } from '../src/features/auth/guards';

const auth = (isVerified: boolean, signedOut = false): AuthContextValue => ({
  session: isVerified ? ({ user: { email_confirmed_at: 'now' } } as unknown as Session) : null,
  loading: false,
  isVerified,
  signIn: async () => {},
  signOut: async () => {},
  signedOut,
});

function renderAt(path: string, value: AuthContextValue) {
  const router = createMemoryRouter(
    [
      {
        element: <ProtectedRoute />,
        children: [{ path: '/dashboard', element: <p>dashboard</p> }],
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

describe('route guards (spec 4.5)', () => {
  it('sends visitors without a verified session from /dashboard to /login', () => {
    renderAt('/dashboard', auth(false));
    expect(screen.getByText('login')).toBeInTheDocument();
  });

  it('after logout, /dashboard sends the user home, not to /login', () => {
    renderAt('/dashboard', auth(false, true));
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('lets verified users into /dashboard', () => {
    renderAt('/dashboard', auth(true));
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('sends logged-in users from /login to /dashboard', () => {
    renderAt('/login', auth(true));
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });
});
