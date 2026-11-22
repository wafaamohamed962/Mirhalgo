import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import '../../src/i18n/portal';
import { RequestSuccessModal } from '../../src/features/portal/requests/RequestSuccessModal';

/* B3: the success modal is "ready for later" (the service forms come in a later plan). */

function renderModal(companies: string[], onClose = vi.fn()) {
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <RequestSuccessModal reference="MG-R-2026-000200" companies={companies} onClose={onClose} />
      ),
    },
  ]);
  render(<RouterProvider router={router} />);
  return within(screen.getByRole('dialog', { name: 'Request sent' }));
}

describe('RequestSuccessModal', () => {
  it('shows the reference, the companies and the actions', () => {
    const dialog = renderModal(['Nile Bridge Logistics', 'Lotus Freight']);
    expect(dialog.getByText('MG-R-2026-000200')).toBeInTheDocument();
    expect(dialog.getByText('Nile Bridge Logistics and Lotus Freight')).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Print' })).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(dialog.getByRole('link', { name: 'View my orders' })).toHaveAttribute(
      'href',
      '/app/orders',
    );
  });

  it('without chosen companies it says "All matching companies"; Print calls the browser', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const dialog = renderModal([]);
    expect(dialog.getByText('All matching companies')).toBeInTheDocument();
    await userEvent.click(dialog.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalled();
  });
});
