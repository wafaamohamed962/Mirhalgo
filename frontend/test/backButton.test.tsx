import { StrictMode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createBrowserRouter, Link, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { UserRole } from '@mirhalgo/shared';
import { BackButton } from '../src/components/ui';
import { AuthContext, type AuthContextValue } from '../src/features/auth/authContext';
import { backFallback } from '../src/features/auth/roles';
import { useUnsavedChangesGuard } from '../src/lib/useUnsavedChangesGuard';

/*
 * "Back" (addition beyond the MW_003 spec): the previous page inside the app, else the logical
 * parent for this viewer (role / auth state). A browser router on jsdom's history, because the
 * button reads React Router's history index.
 */

type Who = 'guest' | UserRole;

function auth(who: Who, loading = false): AuthContextValue {
  return {
    session: null,
    loading,
    isVerified: who !== 'guest',
    role: who === 'guest' ? null : who,
    signIn: async () => {},
    signOut: async () => {},
    signedOut: false,
  };
}

function FormPage() {
  const guard = useUnsavedChangesGuard(true, { title: 'Leave the form?' });
  return (
    <>
      <BackButton />
      <p>form page</p>
      {guard.dialog}
    </>
  );
}

const withBack = (text: string) => (
  <>
    <BackButton />
    <p>{text}</p>
  </>
);

/** Opens `path` as the first page of a fresh tab (no in-app history), as `who`. */
function renderAt(path: string, who: Who = 'customer', loading = false) {
  window.history.replaceState(null, '', path);
  const router = createBrowserRouter([
    {
      path: '/app/orders',
      element: (
        <>
          <p>orders list</p>
          <Link to="/app/orders/42">open order</Link>
          <Link to="/app/support/form">open form</Link>
        </>
      ),
    },
    { path: '/app/orders/:id', element: withBack('order details') },
    { path: '/app/support/form', element: <FormPage /> },
    { path: '/app/new-request', element: <p>new request</p> },
    { path: '/application-status', element: withBack('application status') },
    { path: '/login', element: withBack('login') },
    { path: '/', element: <p>landing</p> },
    { path: '*', element: withBack('not found') },
  ]);
  render(
    <StrictMode>
      <AuthContext.Provider value={auth(who, loading)}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </StrictMode>,
  );
  return router;
}

const back = () => screen.getByRole('button', { name: 'Back to the previous page' });

describe('BackButton', () => {
  it('goes back to the exact previous page, query string included', async () => {
    const user = userEvent.setup();
    const router = renderAt('/');
    await router.navigate('/app/orders?tab=completed&search=MG');
    await user.click(await screen.findByRole('link', { name: 'open order' }));
    expect(await screen.findByText('order details')).toBeInTheDocument();

    await user.click(back());
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/orders'));
    expect(router.state.location.search).toBe('?tab=completed&search=MG');
    expect(router.state.historyAction).toBe('POP');
  });

  it('opened directly: the logical parent, replacing the entry (nothing to come back to)', async () => {
    const user = userEvent.setup();
    const router = renderAt('/app/orders/42');
    expect(await screen.findByText('order details')).toBeInTheDocument();
    const entries = window.history.length;

    await user.click(back());
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/orders'));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(window.history.length).toBe(entries);
  });

  it.each([
    ['guest on an auth page', 'guest', '/login', '/'],
    ['guest on a missing page', 'guest', '/nowhere', '/'],
    ['customer on a missing page', 'customer', '/nowhere', '/app/new-request'],
    ['company on a missing page', 'company', '/nowhere', '/application-status'],
    ['company on its status page', 'company', '/application-status', '/'],
  ] as const)('fallback by role / auth: %s → %s', async (_, who, path, parent) => {
    const user = userEvent.setup();
    const router = renderAt(path, who);
    await user.click(await screen.findByRole('button', { name: 'Back to the previous page' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(parent));
  });

  it('while the session is still loading, a page opened directly waits (no guest fallback)', async () => {
    // regression: a company on the 404 page was sent to the landing page, as if logged out
    renderAt('/nowhere', 'company', true);
    expect(await screen.findByRole('button', { name: 'Back to the previous page' })).toBeDisabled();
  });

  it('a form with unsaved data asks first: Stay keeps the page, Leave goes back', async () => {
    const user = userEvent.setup();
    const router = renderAt('/app/orders');
    await user.click(await screen.findByRole('link', { name: 'open form' }));
    expect(await screen.findByText('form page')).toBeInTheDocument();

    await user.click(back());
    const dialog = await screen.findByRole('dialog', { name: 'Leave the form?' });
    await user.click(within(dialog).getByRole('button', { name: 'Stay' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/app/support/form');

    await user.click(back());
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Leave' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/orders'));
  });

  it('shows "Back" with an arrow that turns in RTL, and is a keyboard-focusable button', async () => {
    renderAt('/app/orders/42');
    const button = await screen.findByRole('button', { name: 'Back to the previous page' });
    expect(button).toHaveTextContent('Back');
    expect(button).toHaveAttribute('type', 'button');
    expect(button.querySelector('svg')).toHaveClass('rtl:rotate-180');
    button.focus();
    expect(button).toHaveFocus();
  });
});

describe('backFallback (the page / parent map)', () => {
  const guest = { isVerified: false, role: null };
  const customer = { isVerified: true, role: 'customer' as const };
  const company = { isVerified: true, role: 'company' as const };

  it('customer: a detail page goes to its list, anything else to New Request', () => {
    expect(backFallback('/app/orders/ord_1', customer)).toBe('/app/orders');
    expect(backFallback('/app/companies/co_1', customer)).toBe('/app/companies');
    expect(backFallback('/app/support/tickets/tk_1', customer)).toBe('/app/support');
    expect(backFallback('/app/account/security', customer)).toBe('/app/account');
    expect(backFallback('/app/notifications', customer)).toBe('/app/new-request');
  });

  it('never a page the viewer cannot open', () => {
    // a company (or a guest) is never sent into the customer portal
    expect(backFallback('/app/orders/ord_1', company)).toBe('/application-status');
    expect(backFallback('/app/orders/ord_1', guest)).toBe('/');
    // a sign-up waiting for its code is still a guest
    expect(backFallback('/verify-email', { isVerified: false, role: 'customer' })).toBe('/');
  });
});
