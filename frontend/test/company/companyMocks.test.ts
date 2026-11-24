import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  INQUIRY_ID_PATTERN,
  OFFER_ID_PATTERN,
  SERVICE_CATEGORIES,
  offerInputSchema,
  type CompanyAccount,
  type CompanyDashboard,
  type CompanyInquiry,
  type CompanyOffer,
  type CompanyRequest,
  type CompetitorComparison,
  type CompetitorRow,
} from '@mirhalgo/shared';
import { createCompanyStore, type KeyValueStorage } from '../../src/mocks/company/db';
import { COMPANIES, buildFixtures } from '../../src/mocks/company/fixtures';
import { createCompanyHandlers } from '../../src/mocks/company/handlers';

/*
 * Company portal mock API (MW_004 B1): it must behave like the future backend, privacy
 * included, so these tests read the RAW responses, not the UI.
 */

/** In-memory localStorage stand-in, shared by every store created in a test. */
function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = (sub: string, role = 'company', email = 'demo.company@mirhalgo.com') =>
  [b64({ alg: 'none' }), b64({ sub, email, app_metadata: { role } }), 'sig'].join('.');

let storage = memoryStorage();
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  storage = memoryStorage();
  server.resetHandlers(...createCompanyHandlers(createCompanyStore(storage), { latency: 0 }));
});

type Result<T> = {
  status: number;
  body: { ok: boolean; data: T; error?: { code: string } };
  raw: string;
};
async function call<T>(method: string, path: string, body?: unknown, who = token('company-a')) {
  const response = await fetch(`http://api.test/api/company${path}`, {
    method,
    headers: { authorization: `Bearer ${who}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  return { status: response.status, body: JSON.parse(raw), raw } as Result<T>;
}
const get = <T>(path: string, who?: string) => call<T>('GET', path, undefined, who);

const competitorNames = COMPANIES.slice(1).flatMap((c) => [
  c.id,
  c.legalName,
  ...(c.alias ? [c.alias] : []),
]);
const CLIENT_VALUES = [
  'منى عبد الرحمن',
  '+201011112222',
  'مؤسسة الأمل للتجارة',
  'كريم حسن',
  '+201022223333',
];
const egpOffer = {
  template: 'domestic_land',
  details: { transitDays: '2' },
  total: { egp: '٧٥٠٠' },
};

describe('fixtures', () => {
  it('28 valid orders over the 6 categories; every offer is a valid offer; unique ids', () => {
    const data = buildFixtures();
    expect(data.orders).toHaveLength(28);
    expect(new Set(data.orders.map((o) => o.id)).size).toBe(28);
    expect(COMPANIES).toHaveLength(6);
    for (const offer of data.offers) {
      expect(offer.id).toMatch(OFFER_ID_PATTERN);
      expect(
        offerInputSchema.safeParse({
          template: offer.template,
          details: offer.details,
          total: offer.total,
        }).success,
      ).toBe(true);
    }
    expect(new Set(data.offers.map((o) => o.id)).size).toBe(data.offers.length);
    for (const inquiry of data.inquiries) expect(inquiry.id).toMatch(INQUIRY_ID_PATTERN);
  });
});

describe('auth (like the real API)', () => {
  it('401 without a valid token, 403 for a customer', async () => {
    const response = await fetch('http://api.test/api/company/me');
    expect(response.status).toBe(401);
    expect((await get('/me', 'not-a-jwt')).status).toBe(401);
    expect((await get('/me', token('c-1', 'customer'))).body.error?.code).toBe('FORBIDDEN');
  });

  it('GET /me: the demo company, its login email and settings', async () => {
    const { body } = await get<CompanyAccount>('/me');
    expect(body.data).toMatchObject({
      id: 'company-a',
      legalName: 'أليكس إكسبريس للشحن الدولي واللوجستيات',
      alias: 'الناقل الذهبي',
      email: 'demo.company@mirhalgo.com',
      contactEmail: 'demo.company@mirhalgo.com',
      accountStatus: 'approved',
      offerSubmission: 'allowed',
      hideOffers: false,
    });
  });
});

describe('privacy (spec B1), on the raw responses', () => {
  it('no client contact data in any order; competitors never named in any response', async () => {
    const requests = (await get<CompanyRequest[]>('/requests')).body.data;
    const raws = [
      (await get('/requests')).raw,
      (await get('/offers')).raw,
      (await get('/dashboard')).raw,
      (await get('/competitors')).raw,
      (await get('/inquiries')).raw,
    ];
    for (const request of requests) {
      raws.push(
        (await get(`/requests/${request.id}`)).raw,
        (await get(`/competitors/${request.id}`)).raw,
      );
    }
    for (const raw of raws) {
      for (const value of [...CLIENT_VALUES, ...competitorNames]) expect(raw).not.toContain(value);
      expect(raw).not.toMatch(/"(contact|receiverName|receiverPhone|companyId)"/);
    }
  });

  it('hidden companies: never returned, only counted; visible competitors are "#N" per order', async () => {
    const rows = (await get<CompetitorRow[]>('/competitors')).body.data;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.hiddenCount > 0)).toBe(true);
    for (const row of rows) {
      const view = (await get<CompetitorComparison>(`/competitors/${row.orderId}`)).body.data;
      expect(view.competitors).toHaveLength(row.visibleCount);
      expect(view.hiddenCount).toBe(row.hiddenCount);
      const labels = [...new Set(view.competitors.map((c) => c.label))];
      expect(labels).toEqual(labels.map((_, i) => i + 1));
      for (const offer of view.competitors)
        expect(Object.keys(offer).sort()).toEqual([
          'createdAt',
          'label',
          'status',
          'template',
          'total',
        ]);
    }
    // the total on a request counts every offer: ours + visible competitors' + hidden ones
    const requests = (await get<CompanyRequest[]>('/requests')).body.data;
    for (const row of rows) {
      const request = requests.find((r) => r.id === row.orderId);
      if (!request) continue; // an order we offered on but are no longer assigned to
      const view = (await get<CompetitorComparison>(`/competitors/${row.orderId}`)).body.data;
      expect(request.offersCount).toBe(
        request.ourOffersCount + view.competitors.length + hiddenOffers(row.orderId),
      );
    }
  });

  it('orders assigned to other companies only: not listed and 404', async () => {
    const listed = new Set((await get<CompanyRequest[]>('/requests')).body.data.map((r) => r.id));
    const unseen = buildFixtures().orders.filter((o) => !o.assignedTo.includes('self'));
    expect(unseen.length).toBeGreaterThan(0);
    for (const order of unseen) {
      expect(listed.has(order.id)).toBe(false);
      expect((await get(`/requests/${order.id}`)).status).toBe(404);
      expect((await get(`/competitors/${order.id}`)).status).toBe(404);
    }
  });
});

/** Offers of hidden companies on an order, straight from the fixtures. */
function hiddenOffers(orderId: string) {
  const hidden = new Set<string>(COMPANIES.filter((c) => c.hideOffers).map((c) => c.id));
  return buildFixtures().offers.filter((o) => o.orderId === orderId && hidden.has(o.companyId))
    .length;
}

describe('available requests and the dashboard', () => {
  it('assigned requests only, newest first, every category present', async () => {
    const requests = (await get<CompanyRequest[]>('/requests')).body.data;
    expect(requests).toHaveLength(23);
    const dates = requests.map((r) => r.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(new Set(requests.map((r) => r.category))).toEqual(new Set(SERVICE_CATEGORIES));
  });

  it('KPIs and badge counts follow the data; lists are limited', async () => {
    const { kpis, counts, awaitingOffer, latestOffers, activity } = (
      await get<CompanyDashboard>('/dashboard')
    ).body.data;
    const offers = (await get<CompanyOffer[]>('/offers')).body.data;
    expect(kpis.offersSubmitted).toBe(offers.length);
    expect(kpis.offersAccepted).toBe(offers.filter((o) => o.status === 'accepted').length);
    expect(kpis.offersRejected).toBe(offers.filter((o) => o.status === 'rejected').length);
    expect(kpis.completedOrders).toBe(2);
    expect(kpis.avgResponseHours).toBeGreaterThan(0);
    expect(kpis.onTimeRate).toBe(94);
    expect(counts.offersUnderReview).toBe(offers.filter((o) => o.status === 'under_review').length);
    expect(counts.requestsWithoutOffer).toBe(awaitingOffer.length);
    expect(awaitingOffer.every((r) => r.status === 'open' && r.ourOffersCount === 0)).toBe(true);
    expect(latestOffers).toHaveLength(5);
    expect(activity.length).toBeLessThanOrEqual(10);
    expect(counts.inquiriesAwaiting).toBe(6);
  });
});

describe('offers (spec B5)', () => {
  async function openDomesticRequest() {
    const requests = (await get<CompanyRequest[]>('/requests')).body.data;
    return requests.find((r) => r.status === 'open' && r.category === 'domestic_land')!;
  }

  it('submit: 201 under review, unique ids, lists, badges, KPIs and the log update', async () => {
    const request = await openDomesticRequest();
    const before = (await get<CompanyDashboard>('/dashboard')).body.data;
    const first = await call<CompanyOffer>('POST', `/requests/${request.id}/offers`, egpOffer);
    const second = await call<CompanyOffer>('POST', `/requests/${request.id}/offers`, egpOffer); // more than one is allowed
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({
      orderId: request.id,
      status: 'under_review',
      total: { egp: 7500 },
      details: { transitDays: 2 },
    });
    expect(first.body.data.id).toMatch(OFFER_ID_PATTERN);
    expect(second.body.data.id).not.toBe(first.body.data.id);

    const after = (await get<CompanyDashboard>('/dashboard')).body.data;
    expect(after.kpis.offersSubmitted).toBe(before.kpis.offersSubmitted + 2);
    expect(after.counts.offersUnderReview).toBe(before.counts.offersUnderReview + 2);
    expect(after.activity[0]).toMatchObject({
      type: 'offer_submitted',
      offerId: second.body.data.id,
    });
    const row = (await get<CompanyRequest[]>('/requests')).body.data.find(
      (r) => r.id === request.id,
    )!;
    expect(row.ourOffersCount).toBe(request.ourOffersCount + 2);
  });

  it('refused: wrong template, invalid total, closed order, not assigned, suspended', async () => {
    const request = await openDomesticRequest();
    const post = (id: string, body: unknown) => call('POST', `/requests/${id}/offers`, body);
    expect((await post(request.id, { ...egpOffer, template: 'sea' })).status).toBe(400);
    expect((await post(request.id, { ...egpOffer, total: {} })).status).toBe(400);
    const closed = (await get<CompanyRequest[]>('/requests')).body.data.find(
      (r) => r.status !== 'open',
    )!;
    expect((await post(closed.id, egpOffer)).body.error?.code).toBe('ORDER_NOT_OPEN');
    expect((await post('MG1024', egpOffer)).status).toBe(404); // assigned to others only

    await call('PATCH', '/demo/offer-submission', { status: 'suspended' });
    expect((await post(request.id, egpOffer)).body.error?.code).toBe('OFFER_SUBMISSION_SUSPENDED');
    expect((await get<CompanyAccount>('/me')).body.data.offerSubmission).toBe('suspended');
  });

  it("edit: only under review, stays under review; never another company's offer", async () => {
    const offers = (await get<CompanyOffer[]>('/offers')).body.data;
    const open = offers.find((o) => o.status === 'under_review')!;
    const done = offers.find((o) => o.status === 'rejected')!;
    const edited = await call<CompanyOffer>('PATCH', `/offers/${open.id}`, {
      template: open.template,
      details: {},
      total: open.total,
    });
    expect(edited.status).toBe(200);
    expect(edited.body.data).toMatchObject({ id: open.id, status: 'under_review', details: {} });
    expect(edited.body.data.updatedAt > open.updatedAt).toBe(true);
    expect(
      (
        await call('PATCH', `/offers/${done.id}`, {
          template: done.template,
          details: {},
          total: done.total,
        })
      ).body.error?.code,
    ).toBe('OFFER_NOT_EDITABLE');

    const competitorOffer = buildFixtures().offers.find((o) => o.companyId !== 'self')!;
    expect((await call('PATCH', `/offers/${competitorOffer.id}`, egpOffer)).status).toBe(404);
  });
});

describe('inquiries (spec B8)', () => {
  it('reply once: replied with a date, then read-only (409); too short → 400', async () => {
    const inquiries = (await get<CompanyInquiry[]>('/inquiries')).body.data;
    const waiting = inquiries.find((i) => i.status === 'awaiting_reply')!;
    expect(waiting.ours.length).toBeGreaterThan(0); // linked to our offer
    expect((await call('POST', `/inquiries/${waiting.id}/reply`, { reply: 'short' })).status).toBe(
      400,
    );
    const sent = await call<CompanyInquiry>('POST', `/inquiries/${waiting.id}/reply`, {
      reply: 'نعم، يشمل السعر التخليص الجمركي.',
    });
    expect(sent.body.data).toMatchObject({
      status: 'replied',
      reply: { text: 'نعم، يشمل السعر التخليص الجمركي.' },
    });
    expect(
      (await call('POST', `/inquiries/${waiting.id}/reply`, { reply: 'A different answer later.' }))
        .body.error?.code,
    ).toBe('INQUIRY_ALREADY_REPLIED');
  });
});

describe('settings (spec B9)', () => {
  it('contact: validated and saved; privacy: saved and logged; password: mocked', async () => {
    expect(
      (
        await call('PATCH', '/settings/contact', {
          contactEmail: 'bad',
          contactPhone: '+201000000002',
        })
      ).status,
    ).toBe(400);
    const saved = await call<CompanyAccount>('PATCH', '/settings/contact', {
      contactEmail: 'ops@alex.example',
      contactPhone: '+201000000002',
    });
    expect(saved.body.data).toMatchObject({
      contactEmail: 'ops@alex.example',
      contactPhone: '+201000000002',
      email: 'demo.company@mirhalgo.com',
    });

    const privacy = await call<CompanyAccount>('PATCH', '/settings/privacy', { hideOffers: true });
    expect(privacy.body.data.hideOffers).toBe(true);
    expect((await get<CompanyDashboard>('/dashboard')).body.data.activity[0]).toMatchObject({
      type: 'privacy_changed',
      hideOffers: true,
    });

    const password = { password: 'N3w!Password', confirmPassword: 'N3w!Password' };
    expect(
      (await call('POST', '/settings/password', { ...password, currentPassword: 'wrong' })).body
        .error?.code,
    ).toBe('INVALID_CREDENTIALS');
    expect(
      (
        await call('POST', '/settings/password', {
          ...password,
          currentPassword: 'old',
          password: 'weak',
          confirmPassword: 'weak',
        })
      ).status,
    ).toBe(400);
    expect(
      (await call('POST', '/settings/password', { ...password, currentPassword: 'old' })).status,
    ).toBe(200);
  });
});

describe('persistence per account + reset (spec B1)', () => {
  it('survives a reload (a new store on the same storage); other accounts are separate', async () => {
    await call('PATCH', '/settings/privacy', { hideOffers: true });
    expect([...storage.data.keys()]).toEqual(['mirhalgo.companyDemo.v1.company-a']);

    // "reload": new handlers + store over the same localStorage
    server.resetHandlers(...createCompanyHandlers(createCompanyStore(storage), { latency: 0 }));
    expect((await get<CompanyAccount>('/me')).body.data.hideOffers).toBe(true);
    expect((await get<CompanyAccount>('/me', token('company-b'))).body.data.hideOffers).toBe(false);
  });

  it('"Reset demo data" starts the account again from the fixtures', async () => {
    const request = (await get<CompanyRequest[]>('/requests')).body.data.find(
      (r) => r.status === 'open' && r.category === 'domestic_land',
    )!;
    const added = await call<CompanyOffer>('POST', `/requests/${request.id}/offers`, egpOffer);
    await call('POST', '/demo/reset');
    const offers = (await get<CompanyOffer[]>('/offers')).body.data;
    expect(offers.some((o) => o.id === added.body.data.id)).toBe(false);
    expect(offers).toHaveLength(
      buildFixtures().offers.filter((o) => o.companyId === 'self').length,
    );
  });
});
