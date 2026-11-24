import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CompanyOffer } from '@mirhalgo/shared';
import OffersPage from '../../src/features/companyPortal/pages/OffersPage';
import { companyFetch, renderCompany, resetCompanyMocks, server } from './renderCompany';

/* Our submitted offers (MW_004 spec B6): stats, filter, search, groups, cards, actions. */

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  resetCompanyMocks();
  localStorage.clear();
});

const renderOffers = (path = '/company/offers') => renderCompany(path, { offers: <OffersPage /> });
const groups = async () => {
  await screen.findAllByRole('region', { name: /^Our offers on request/ }, { timeout: 5000 });
  return screen.getAllByRole('region', { name: /^Our offers on request/ });
};
const card = (id: string) => within(screen.getByText(id).closest('li')!);

describe('Our submitted offers', () => {
  it('stats bar: total, under review, accepted, rejected', async () => {
    renderOffers();
    await groups();
    const stats = screen
      .getAllByRole('definition')
      .slice(0, 4)
      .map((d) => d.textContent);
    expect(stats).toEqual(['18', '11', '3', '4']);
  });

  it('grouped by order, groups sorted by their latest offer; the header names the order', async () => {
    const offers = await companyFetch<CompanyOffer[]>('/offers');
    renderOffers();
    const list = await groups();
    const latestOrder = offers[0]!.orderId; // the API lists newest first
    expect(list[0]).toHaveAccessibleName(`Our offers on request ${latestOrder}`);
    // one order has two of our offers
    const two = list.find((g) => within(g).queryByText('Our offers: 2'));
    expect(two).toBeDefined();
    expect(within(two!).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list[0]!).getByRole('button', { name: 'Order details' })).toBeInTheDocument();
  });

  it('status filter (in the URL): rejected cards show their reason', async () => {
    const user = userEvent.setup();
    const router = renderOffers();
    await groups();
    await user.click(screen.getByRole('tab', { name: /Rejected/ }));
    await waitFor(() => expect(router.state.location.search).toBe('?status=rejected'));
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(4);
    for (const c of cards) expect(within(c).getByText(/Rejection reason/)).toBeInTheDocument();
  });

  it('search by offer id or order id', async () => {
    const user = userEvent.setup();
    const offers = await companyFetch<CompanyOffer[]>('/offers');
    renderOffers();
    await groups();
    await user.type(screen.getByRole('searchbox', { name: 'Search offers' }), offers[3]!.id);
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(await screen.findByText('No offers match your search or filter.')).toBeInTheDocument();
  });

  it('opening a card shows its template fields and removes "New"', async () => {
    const user = userEvent.setup();
    const sea = (await companyFetch<CompanyOffer[]>('/offers')).find((o) => o.template === 'sea')!;
    renderOffers();
    await groups();
    expect(card(sea.id).getByText('New')).toBeInTheDocument();
    await user.click(card(sea.id).getByRole('button', { name: 'Show offer details' }));
    expect(card(sea.id).getByText('Ocean freight')).toBeInTheDocument();
    expect(card(sea.id).getByText('Transit time (days)')).toBeInTheDocument();
    expect(card(sea.id).queryByText('New')).not.toBeInTheDocument();
  });

  it('Edit only while under review (opens the edit form); Compare when the order has > 1 offer', async () => {
    const user = userEvent.setup();
    const offers = await companyFetch<CompanyOffer[]>('/offers');
    const open = offers.find((o) => o.status === 'under_review')!;
    const done = offers.find((o) => o.status !== 'under_review')!;
    const router = renderOffers();
    await groups();
    expect(card(done.id).queryByRole('button', { name: 'Edit offer' })).not.toBeInTheDocument();
    await user.click(card(open.id).getByRole('button', { name: 'Edit offer' }));
    expect(router.state.location.search).toBe(`?edit=${open.id}`);
    expect(
      await screen.findByRole('dialog', { name: `Edit offer ${open.id}` }),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const comparable = screen.getAllByRole('button', { name: 'Compare prices' });
    expect(comparable.length).toBeGreaterThan(0);
    await user.click(comparable[0]!);
    expect(await screen.findByRole('dialog', { name: /^Price comparison/ })).toBeInTheDocument();
  });

  it('an old edit link of an offer past review explains instead of opening the form', async () => {
    const done = (await companyFetch<CompanyOffer[]>('/offers')).find(
      (o) => o.status === 'rejected',
    )!;
    renderOffers(`/company/offers?edit=${done.id}`);
    expect(
      await screen.findByText(/can no longer be edited/, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
