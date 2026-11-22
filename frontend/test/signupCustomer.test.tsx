import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import SignupCustomerPage from '../src/features/auth/pages/SignupCustomerPage';

/* Customer sign-up: "Back to home" + confirmation when the form has data (MW_003 A3). */

window.scrollTo = () => {};

function renderSignup() {
  const router = createMemoryRouter(
    [
      { path: '/signup/customer', element: <SignupCustomerPage /> },
      { path: '/', element: <p>home page</p> },
    ],
    { initialEntries: ['/signup/customer'] },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('customer sign-up: Back to home', () => {
  it('leaves at once when nothing was typed', async () => {
    const user = userEvent.setup();
    const router = renderSignup();
    await user.click(screen.getByRole('link', { name: 'Back to home' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks first when the form has data (no draft: the data would be lost)', async () => {
    const user = userEvent.setup();
    const router = renderSignup();
    await user.type(screen.getByLabelText(/First name/), 'Ali');
    await user.click(screen.getByRole('link', { name: 'Back to home' }));
    const dialog = await screen.findByRole('dialog', { name: 'Leave the form?' });
    expect(dialog).toHaveTextContent('The information you entered will be lost.');
    await user.click(within(dialog).getByRole('button', { name: 'Stay' }));
    expect(router.state.location.pathname).toBe('/signup/customer');
    expect(screen.getByLabelText(/First name/)).toHaveValue('Ali');

    await user.click(screen.getByRole('link', { name: 'Back to home' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Leave' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});
