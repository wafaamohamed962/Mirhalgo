import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CompetitorRow } from '@mirhalgo/shared';
import CompetitorsPage from '../../src/features/companyPortal/pages/CompetitorsPage';
import { COMPANIES } from '../../src/mocks/company/fixtures';
import { companyFetch, renderCompany, resetCompanyMocks, server } from './renderCompany';

/* Competitor offers (MW_004 spec B7): rows, our totals, visible / hidden counts, comparison. */

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  resetCompanyMocks();
  localStorage.clear();
});

const renderCompetitors = () =>
  renderCompany('/company/competitors', { competitors: <CompetitorsPage /> });
const table = async () => within(await screen.findByRole('table'));

describe('Competitor offers', { timeout: 20_000 }, () => {
  it('one row per order with other offers: our totals or "not yet", visible count, hidden count', async () => {
    const rows = await companyFetch<CompetitorRow[]>('/competitors');
    renderCompetitors();
    expect(screen.getByText(/Competitor names are hidden/)).toBeInTheDocument();
    const body = (await table()).getAllByRole('row').slice(1);
    expect(body).toHaveLength(rows.length);
    expect((await table()).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Order ID',
      'Service',
      'Our offer(s)',
      'Visible competitor offers',
      'Compare',
    ]);
    const withoutOurs = rows.find((r) => r.ours.length === 0);
    if (withoutOurs) {
      const row = within((await table()).getByText(withoutOurs.orderId).closest('tr')!);
      expect(row.getByText('We have not submitted an offer yet')).toBeInTheDocument();
    }
    const hidden = rows.find((r) => r.hiddenCount > 0)!;
    const row = within((await table()).getByText(hidden.orderId).closest('tr')!);
    expect(
      row.getByText(`+ Companies hiding their offers: ${hidden.hiddenCount}`),
    ).toBeInTheDocument();
  });

  it('Compare: "#N" only, the hidden line; no competitor name, id or alias anywhere', async () => {
    const user = userEvent.setup();
    const rows = await companyFetch<CompetitorRow[]>('/competitors');
    const target = rows.find((r) => r.visibleCount > 0 && r.hiddenCount > 0)!;
    const router = renderCompetitors();
    await user.click(
      (await table()).getByRole('button', {
        name: `Compare the prices on request ${target.orderId}`,
      }),
    );
    expect(router.state.location.search).toBe(`?compare=${target.orderId}`);
    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByText('Competitor company #1')).toBeInTheDocument();
    expect(
      dialog.getByText(`+ Companies that chose to hide their offers: ${target.hiddenCount}`),
    ).toBeInTheDocument();
    const text = document.body.textContent!;
    for (const company of COMPANIES.slice(1)) {
      for (const value of [company.legalName, company.id, company.alias].filter(Boolean)) {
        expect(text).not.toContain(value);
      }
    }
    await user.keyboard('{Escape}');
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });
});
