import { act, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CompanyDashboard } from '@mirhalgo/shared';
import i18n from '../../src/i18n';
import OverviewPage from '../../src/features/companyPortal/pages/OverviewPage';
import {
  ACCOUNT_ID,
  companyFetch,
  renderCompany,
  resetCompanyMocks,
  server,
} from './renderCompany';

/* Overview (MW_004 spec B3): KPIs, the 4 blocks, limits, empty / error / suspended states. */

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  resetCompanyMocks();
  localStorage.clear();
});

const renderOverview = () => renderCompany('/company/overview', { overview: <OverviewPage /> });
const block = async (name: string) =>
  within(await screen.findByRole('region', { name }, { timeout: 5000 }));
const kpi = (label: string) => screen.getByText(label).closest('div')!;

describe('Overview', { timeout: 20_000 }, () => {
  it('6 KPI cards computed from the data (Western digits, hours, percent)', async () => {
    renderOverview();
    await block('Requests awaiting our offer');
    // fixtures: 18 offers of ours, 3 accepted, 4 rejected, 2 of the accepted are completed
    expect(kpi('Offers submitted')).toHaveTextContent('18');
    expect(kpi('Offers accepted')).toHaveTextContent('3');
    expect(kpi('Offers rejected')).toHaveTextContent('4');
    expect(kpi('Completed orders')).toHaveTextContent('2');
    expect(kpi('Average response time')).toHaveTextContent(/^Average response time[\d.]+\s*h$/);
    expect(kpi('On-time delivery rate')).toHaveTextContent('94%');
  });

  it('requests awaiting our offer: "new", category, Submit offer (into the requests page), View all', async () => {
    renderOverview();
    const requests = await block('Requests awaiting our offer');
    const rows = requests.getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    const first = within(rows[0]!);
    const id = first.getByRole('link', { name: /^MG\d+$/ }).textContent!;
    expect(first.getByText('New')).toBeInTheDocument();
    expect(first.getByRole('link', { name: `Submit an offer on request ${id}` })).toHaveAttribute(
      'href',
      `/company/requests?order=${id}&offer=new`,
    );
    expect(requests.getByRole('link', { name: 'View all' })).toHaveAttribute(
      'href',
      '/company/requests',
    );
  });

  it('opened items lose "new" (per account)', async () => {
    const dashboard = await companyFetch<CompanyDashboard>('/dashboard');
    const [opened, unopened] = dashboard.awaitingOffer;
    localStorage.setItem(
      `mirhalgo.companySeen.v1.${ACCOUNT_ID}`,
      JSON.stringify({ request: [opened!.id] }),
    );
    renderOverview();
    const requests = await block('Requests awaiting our offer');
    const row = (id: string) => within(requests.getByRole('link', { name: id }).closest('li')!);
    expect(row(opened!.id).queryByText('New')).not.toBeInTheDocument();
    expect(row(unopened!.id).getByText('New')).toBeInTheDocument();
  });

  it('latest offers (5, with totals and status), inquiries awaiting reply (5 of 6), activity (≤ 10)', async () => {
    renderOverview();
    const offers = await block('Our latest offers');
    expect(offers.getAllByRole('listitem')).toHaveLength(5);
    expect(offers.getAllByText(/\d (USD|EUR|EGP)/).length).toBeGreaterThan(0);
    expect(offers.getAllByText(/Under review|Accepted|Rejected/).length).toBe(5);

    const inquiries = await block('Inquiries awaiting reply');
    expect(inquiries.getAllByRole('listitem')).toHaveLength(5);
    expect(inquiries.getAllByText('Awaiting reply')).toHaveLength(5);
    expect(inquiries.getByRole('link', { name: 'View all' })).toHaveAttribute(
      'href',
      '/company/inquiries',
    );

    const activity = await block('Recent account activity');
    const entries = activity.getAllByRole('listitem');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.length).toBeLessThanOrEqual(10);
    const times = activity.getAllByRole('time' as never).map((t) => t.getAttribute('datetime')!);
    expect(times).toEqual([...times].sort().reverse()); // newest first
  });

  it('a change shows up at once: the new offer is first in the log and the latest offers', async () => {
    const dashboard = await companyFetch<CompanyDashboard>('/dashboard');
    const domestic = (
      await companyFetch<Array<{ id: string; category: string; status: string }>>('/requests')
    ).find((r) => r.category === 'domestic_land' && r.status === 'open')!;
    const offer = await companyFetch<{ id: string }>(`/requests/${domestic.id}/offers`, {
      method: 'POST',
      body: JSON.stringify({ template: 'domestic_land', details: {}, total: { egp: 4200 } }),
    });
    renderOverview();
    const offers = await block('Our latest offers');
    expect(within(offers.getAllByRole('listitem')[0]!).getByText(offer.id)).toBeInTheDocument();
    expect(within(offers.getAllByRole('listitem')[0]!).getByText('4,200 EGP')).toBeInTheDocument();
    const activity = await block('Recent account activity');
    expect(
      within(activity.getAllByRole('listitem')[0]!).getByText(
        `Offer ${offer.id} was submitted on request ${domestic.id}.`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Offers submitted').closest('div')).toHaveTextContent(
      String(dashboard.kpis.offersSubmitted + 1),
    );
  });

  it('every block has an empty state', async () => {
    const empty: CompanyDashboard = {
      kpis: {
        offersSubmitted: 0,
        offersAccepted: 0,
        offersRejected: 0,
        completedOrders: 0,
        avgResponseHours: null,
        onTimeRate: null,
      },
      counts: { requestsWithoutOffer: 0, offersUnderReview: 0, inquiriesAwaiting: 0 },
      awaitingOffer: [],
      latestOffers: [],
      awaitingInquiries: [],
      activity: [],
    };
    server.use(
      http.get('*/api/company/dashboard', () => HttpResponse.json({ ok: true, data: empty })),
    );
    renderOverview();
    expect(
      await screen.findByText(
        'No requests are waiting for an offer from us right now.',
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('No offers submitted yet.')).toBeInTheDocument();
    expect(screen.getByText('No inquiries are awaiting a reply.')).toBeInTheDocument();
    expect(screen.getByText('No account activity yet.')).toBeInTheDocument();
    expect(kpi('Average response time')).toHaveTextContent('—');
  });

  it('an error shows a retry', async () => {
    server.use(
      http.get('*/api/company/dashboard', () =>
        HttpResponse.json(
          { ok: false, error: { code: 'INTERNAL', message: 'x' } },
          { status: 500 },
        ),
      ),
    );
    renderOverview();
    const alert = await screen.findByRole('alert', {}, { timeout: 5000 });
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('offer submission suspended: an explanation and disabled Submit offer buttons', async () => {
    await companyFetch('/demo/offer-submission', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'suspended' }),
    });
    renderOverview();
    const requests = await block('Requests awaiting our offer');
    expect(
      await requests.findByText(/suspended offer submission for your account/),
    ).toBeInTheDocument();
    for (const button of requests.getAllByRole('button', { name: 'Submit offer' }))
      expect(button).toBeDisabled();
    expect(requests.queryByRole('link', { name: /Submit an offer/ })).not.toBeInTheDocument();
  });

  it('Arabic: formal copy, Western digits in money and KPIs', async () => {
    await act(() => i18n.changeLanguage('ar'));
    renderOverview();
    const offers = await block('أحدث عروضنا');
    expect(offers.getAllByText(/\d (دولار|يورو|جنيه)/).length).toBeGreaterThan(0);
    expect(screen.getByText('متوسط وقت الاستجابة').closest('div')).toHaveTextContent(
      /[\d.]+\s*ساعة/,
    );
    expect(screen.getByText('نسبة التسليم في الموعد').closest('div')).toHaveTextContent('94%');
    await act(() => i18n.changeLanguage('en'));
  });
});
