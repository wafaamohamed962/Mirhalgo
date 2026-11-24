import { render, screen } from '@testing-library/react';
import { createMemoryRouter, Navigate, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import type { CompanyStatus, UserRole } from '@mirhalgo/shared';
import { AuthContext, type AuthContextValue } from '../src/features/auth/authContext';
import {
  CompanyStatusRoute,
  GuestRoute,
  HomeRedirect,
  ProtectedRoute,
} from '../src/features/auth/guards';
import { homePath } from '../src/features/auth/roles';

const auth = (
  role: UserRole | null,
  {
    verified = true,
    signedOut = false,
    companyStatus = null,
  }: { verified?: boolean; signedOut?: boolean; companyStatus?: CompanyStatus | null } = {},
): AuthContextValue => ({
  session: verified ? ({ user: { email_confirmed_at: 'now' } } as unknown as Session) : null,
  loading: false,
  isVerified: verified,
  role,
  companyStatus,
  signIn: async () => {},
  signOut: async () => {},
  signedOut,
});

/** The real route shape (app/router.tsx), with a text per page. */
function renderAt(path: string, value: AuthContextValue) {
  const router = createMemoryRouter(
    [
      {
        element: <ProtectedRoute allow={['customer']} />,
        children: [{ path: '/app/*', element: <p>customer portal</p> }],
      },
      {
        path: '/company',
        element: <ProtectedRoute allow={['company']} />,
        children: [
          {
            element: <CompanyStatusRoute approved />,
            children: [
              { index: true, element: <Navigate to="overview" replace /> },
              { path: 'overview', element: <p>company overview</p> },
              { path: 'offers', element: <p>company offers</p> },
            ],
          },
          {
            element: <CompanyStatusRoute approved={false} />,
            children: [{ path: 'application-status', element: <p>company status</p> }],
          },
        ],
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
  return router;
}

const approved = auth('company', { companyStatus: 'approved' });
const NOT_APPROVED = ['pending_review', 'changes_requested', 'rejected'] as const;

describe('homePath (MW_004 A1)', () => {
  it('customer → New Request; company by status; anyone else → home', () => {
    expect(homePath('customer')).toBe('/app/new-request');
    expect(homePath('company', 'approved')).toBe('/company/overview');
    for (const status of NOT_APPROVED) {
      expect(homePath('company', status)).toBe('/company/application-status');
    }
    // unknown status (no application row, API unreachable): never the portal
    expect(homePath('company', null)).toBe('/company/application-status');
    expect(homePath('admin')).toBe('/');
    expect(homePath(null)).toBe('/');
  });
});

describe('route guards (spec 4.5 + MW_002 A6 + MW_004 A1)', () => {
  it('sends visitors without a verified session to /login', () => {
    renderAt('/app', auth(null, { verified: false }));
    expect(screen.getByText('login')).toBeInTheDocument();
    document.body.innerHTML = '';
    renderAt('/company/overview', auth(null, { verified: false }));
    expect(screen.getByText('login')).toBeInTheDocument();
  });

  it('after logout, protected pages send the user home, not to /login', () => {
    renderAt('/company/offers', auth(null, { verified: false, signedOut: true }));
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('lets verified customers into the customer portal', () => {
    renderAt('/app', auth('customer'));
    expect(screen.getByText('customer portal')).toBeInTheDocument();
  });

  it('a customer opening a company URL lands on New Request (replace)', () => {
    const router = renderAt('/company/offers', auth('customer'));
    expect(screen.getByText('customer portal')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app/new-request');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it.each([
    ['/company', '/company/overview'],
    ['/company/offers', '/company/offers'],
    ['/app/orders/1', '/company/overview'],
    ['/company/application-status', '/company/overview'],
  ])('an approved company opening %s ends on %s', (path, expected) => {
    const router = renderAt(path, approved);
    expect(router.state.location.pathname).toBe(expected);
  });

  it.each(NOT_APPROVED)('a %s company: only the status page, from any portal URL', (status) => {
    for (const path of ['/company', '/company/offers', '/app/new-request']) {
      document.body.innerHTML = '';
      const router = renderAt(path, auth('company', { companyStatus: status }));
      expect(screen.getByText('company status')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/company/application-status');
    }
  });

  it('a session without a known role gets no portal', () => {
    renderAt('/app', auth(null));
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it.each([
    ['customer', auth('customer'), 'customer portal'],
    ['approved company', approved, 'company overview'],
    ['pending company', auth('company', { companyStatus: 'pending_review' }), 'company status'],
  ] as const)('/dashboard and /login send a logged-in %s to their home', (_, value, page) => {
    renderAt('/dashboard', value);
    expect(screen.getByText(page)).toBeInTheDocument();
    document.body.innerHTML = '';
    renderAt('/login', value);
    expect(screen.getByText(page)).toBeInTheDocument();
  });
});
