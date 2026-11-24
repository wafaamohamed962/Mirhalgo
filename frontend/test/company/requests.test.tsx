import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CompanyRequest } from '@mirhalgo/shared';
import RequestsPage from '../../src/features/companyPortal/pages/RequestsPage';
import { COMPANIES } from '../../src/mocks/company/fixtures';
import { companyFetch, renderCompany, resetCompanyMocks, server } from './renderCompany';

/* Available requests (MW_004 spec B4): list, search, details, comparison, URL modals. */

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  resetCompanyMocks();
  localStorage.clear();
});

const renderRequests = (path = '/company/requests') =>
  renderCompany(path, { requests: <RequestsPage /> });
/** The desktop table (the phone cards repeat the same content, hidden by CSS). */
const table = async () => within(await screen.findByRole('table', {}, { timeout: 5000 }));
const row = async (id: string) => within((await table()).getByText(id).closest('tr')!);

describe('Available requests', () => {
  it('assigned requests, newest first, with every column', async () => {
    const requests = await companyFetch<CompanyRequest[]>('/requests');
    renderRequests();
    const rows = (await table()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(requests.length);
    expect(within(rows[0]!).getByText(requests[0]!.id)).toBeInTheDocument();
    expect((await table()).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Order ID',
      'Date',
      'Service',
      'Offers on this order',
      'Status',
      'Actions',
    ]);
    expect(
      screen.getByText(/Only requests that the platform administration has assigned/),
    ).toBeInTheDocument();
  });

  it('offers column: the total opens the comparison, "(you have N)", additional offer label', async () => {
    const requests = await companyFetch<CompanyRequest[]>('/requests');
    const withOurs = requests.find((r) => r.ourOffersCount > 0 && r.status === 'open')!;
    renderRequests();
    const r = await row(withOurs.id);
    expect(r.getByText(`(you have ${withOurs.ourOffersCount})`)).toBeInTheDocument();
    expect(
      r.getByRole('button', { name: `Submit additional offer — ${withOurs.id}` }),
    ).toBeInTheDocument();
    expect(
      r.getByRole('button', {
        name: `Compare the offers on request ${withOurs.id} (${withOurs.offersCount})`,
      }),
    ).toBeInTheDocument();

    const closed = requests.find((x) => x.status !== 'open')!;
    expect(
      (await row(closed.id)).queryByRole('button', { name: /Submit/ }),
    ).not.toBeInTheDocument();
  });

  it('search by order id or service type, kept in the URL', async () => {
    const user = userEvent.setup();
    const router = renderRequests();
    await table();
    await user.type(screen.getByRole('searchbox', { name: 'Search requests' }), 'SHEIN');
    await waitFor(() => expect(router.state.location.search).toBe('?search=SHEIN'));
    const rows = (await table()).getAllByRole('row').slice(1);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(within(r).getByText('SHEIN')).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(await screen.findByText('No requests match your search.')).toBeInTheDocument();
  });

  it('details: privacy notice, sections without contact data, "New" goes away, Esc closes', async () => {
    const user = userEvent.setup();
    const requests = await companyFetch<CompanyRequest[]>('/requests');
    const id = requests.find((r) => r.category === 'chinese_sites')!.id;
    const router = renderRequests();
    expect((await row(id)).getByText('New')).toBeInTheDocument();
    await user.click((await row(id)).getByRole('button', { name: `Details of request ${id}` }));
    expect(router.state.location.search).toBe(`?order=${id}`);

    const dialog = within(await screen.findByRole('dialog', { name: `Request ${id} details` }));
    expect(await dialog.findByText(/contact details are hidden/)).toBeInTheDocument();
    // the China sections, and the client type (the only contact field a company sees)
    expect(await dialog.findByRole('heading', { name: 'Order' })).toBeInTheDocument();
    expect(dialog.getByRole('heading', { name: 'Shipping & delivery' })).toBeInTheDocument();
    expect(dialog.getByText('Client type')).toBeInTheDocument();
    expect(dialog.getByText('Attachments')).toBeInTheDocument();
    // the fixture client and receiver never reach the company
    for (const value of ['منى عبد الرحمن', 'كريم حسن', 'سارة محمود', 'أحمد يوسف', '+2010']) {
      expect(screen.getByRole('dialog').textContent).not.toContain(value);
    }
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.search).toBe('');
    expect((await row(id)).queryByText('New')).not.toBeInTheDocument();
  });

  it('a link opens the modal directly; closing removes the params (nothing to go back to)', async () => {
    const user = userEvent.setup();
    const router = renderRequests('/company/requests?order=MG1029');
    expect(
      await screen.findByRole('dialog', { name: 'Request MG1029 details' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Close' })[0]!,
    );
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('comparison: our offers, "Competitor company #N", hidden companies counted, never named', async () => {
    const user = userEvent.setup();
    const requests = await companyFetch<CompanyRequest[]>('/requests');
    const target = requests.find((r) => r.ourOffersCount > 0 && r.offersCount > r.ourOffersCount)!;
    renderRequests();
    await user.click((await row(target.id)).getByRole('button', { name: /^Compare the offers/ }));
    const dialog = within(
      await screen.findByRole('dialog', { name: `Price comparison — request ${target.id}` }),
    );
    expect(await dialog.findByText('Our offers')).toBeInTheDocument();
    expect(dialog.getAllByText(/^OF-\d{6}$/).length).toBe(target.ourOffersCount);
    const text = screen.getByRole('dialog').textContent!;
    for (const company of COMPANIES.slice(1)) {
      expect(text).not.toContain(company.legalName);
      expect(text).not.toContain(company.id);
    }
    expect(text).toMatch(/Competitor company #1|No visible offers from other companies/);
  });

  it('offer submission suspended: an explanation and disabled Submit buttons', async () => {
    await companyFetch('/demo/offer-submission', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'suspended' }),
    });
    renderRequests();
    expect(
      await screen.findByText(/suspended offer submission/, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    const buttons = (await table()).getAllByRole('button', { name: /^Submit/ });
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) expect(button).toBeDisabled();
  });
});
