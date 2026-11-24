import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CompanyDashboard, CompanyInquiry } from '@mirhalgo/shared';
import InquiriesPage from '../../src/features/companyPortal/pages/InquiriesPage';
import { companyFetch, renderCompany, resetCompanyMocks, server } from './renderCompany';

/* Client inquiries (MW_004 spec B8): filter, search, the modal, a final read-only reply. */

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  resetCompanyMocks();
  localStorage.clear();
});

const renderInquiries = (path = '/company/inquiries') =>
  renderCompany(path, { inquiries: <InquiriesPage /> });
const cards = async () => {
  await screen.findAllByRole('button', { name: /^Open inquiry/ });
  return screen.getAllByRole('listitem');
};

describe('Client inquiries', { timeout: 20_000 }, () => {
  it('newest first; filter by status (in the URL); search by inquiry or order id', async () => {
    const user = userEvent.setup();
    const inquiries = await companyFetch<CompanyInquiry[]>('/inquiries');
    const router = renderInquiries();
    const list = await cards();
    expect(list).toHaveLength(10);
    expect(within(list[0]!).getByText(inquiries[0]!.id)).toBeInTheDocument();
    expect(within(list[0]!).getByText('New')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Replied/ }));
    await waitFor(() => expect(router.state.location.search).toBe('?status=replied'));
    expect(screen.getAllByRole('listitem')).toHaveLength(4);

    await user.click(screen.getByRole('tab', { name: /All/ }));
    await user.type(
      screen.getByRole('searchbox', { name: 'Search inquiries' }),
      inquiries[2]!.orderId,
    );
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
  });

  it('the modal: order summary without contact data, our offers, the question; reply once, then read-only', async () => {
    const user = userEvent.setup();
    const waiting = (await companyFetch<CompanyInquiry[]>('/inquiries')).find(
      (i) => i.status === 'awaiting_reply',
    )!;
    const before = (await companyFetch<CompanyDashboard>('/dashboard')).counts.inquiriesAwaiting;
    renderInquiries();
    await cards();
    await user.click(screen.getByRole('button', { name: `Open inquiry ${waiting.id}` }));
    const dialog = within(await screen.findByRole('dialog', { name: `Inquiry ${waiting.id}` }));
    expect(dialog.getByText(waiting.question)).toBeInTheDocument();
    expect(dialog.getByText(waiting.ours[0]!.id)).toBeInTheDocument();
    expect(dialog.getByRole('link', { name: 'View the full order details' })).toHaveAttribute(
      'href',
      `/company/requests?order=${waiting.orderId}`,
    );
    for (const value of ['منى عبد الرحمن', 'كريم حسن', '+2010']) {
      expect(screen.getByRole('dialog').textContent).not.toContain(value);
    }

    await user.click(dialog.getByRole('button', { name: 'Send reply' }));
    expect(await dialog.findByText('This field is required')).toBeInTheDocument();
    await user.type(dialog.getByLabelText(/^Reply/), 'Yes, customs clearance is included.');
    await user.click(dialog.getByRole('button', { name: 'Send reply' }));

    // final: shown read-only with its date, no second reply possible
    expect(await dialog.findByText('Our reply')).toBeInTheDocument();
    expect(dialog.getByText('Yes, customs clearance is included.')).toBeInTheDocument();
    expect(dialog.getByText(/^Sent on /)).toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: 'Send reply' })).not.toBeInTheDocument();
    expect(dialog.queryByRole('textbox')).not.toBeInTheDocument();
    expect((await companyFetch<CompanyDashboard>('/dashboard')).counts.inquiriesAwaiting).toBe(
      before - 1,
    );
  });

  it('opening removes "New"; a link opens the inquiry directly', async () => {
    const user = userEvent.setup();
    const first = (await companyFetch<CompanyInquiry[]>('/inquiries'))[0]!;
    renderInquiries(`/company/inquiries?inquiry=${first.id}`);
    expect(await screen.findByRole('dialog', { name: `Inquiry ${first.id}` })).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Close' })[0]!,
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const card = within(screen.getByText(first.id).closest('li')!);
    expect(card.queryByText('New')).not.toBeInTheDocument();
  });

  it('closing with a written reply asks first', async () => {
    const user = userEvent.setup();
    const waiting = (await companyFetch<CompanyInquiry[]>('/inquiries')).find(
      (i) => i.status === 'awaiting_reply',
    )!;
    renderInquiries(`/company/inquiries?inquiry=${waiting.id}`);
    const dialog = within(await screen.findByRole('dialog', { name: `Inquiry ${waiting.id}` }));
    await user.type(dialog.getByLabelText(/^Reply/), 'Draft answer');
    await user.keyboard('{Escape}');
    expect(
      await screen.findByRole('dialog', { name: 'Close the inquiry without sending the reply?' }),
    ).toBeInTheDocument();
  });
});
