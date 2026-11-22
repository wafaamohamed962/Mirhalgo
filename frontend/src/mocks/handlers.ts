import { delay, http, HttpResponse, type JsonBodyType } from 'msw';
import {
  CANCELLABLE_STATUSES,
  ORDER_TABS,
  type ApiError,
  type CompanyProfile,
  type ErrorCode,
  type NotificationEvent,
  type OrderSummary,
  type OrderTab,
} from '@mirhalgo/shared';
import type { MockDb } from './db';

/*
 * MSW handlers for the customer portal (MW_002 B2): same paths and `{ ok, data }` shapes as
 * the future real API. Auth endpoints are not handled here, so they reach the real API
 * (`onUnhandledFrame: 'bypass'`, decision 17).
 */

const ORDERS_PAGE_SIZE = 5;
const OTP_DEMO_CODE = '123456';

const ok = (data: JsonBodyType, status = 200) => HttpResponse.json({ ok: true, data }, { status });
const fail = (status: number, code: ErrorCode) =>
  HttpResponse.json<ApiError>({ ok: false, error: { code, message: code } }, { status });

const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();

/** Copy of `value` without `keys` (list endpoints return summaries). */
const omit = <T extends object, K extends keyof T>(value: T, keys: readonly K[]) =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key as K))) as Omit<
    T,
    K
  >;

const summary = (order: MockDb['orders'][number]): OrderSummary =>
  omit(order, ['details', 'offers', 'timeline', 'cancelReason']);

const inTab = (tab: OrderTab, status: OrderSummary['status']) =>
  tab === 'all' ||
  status === tab ||
  (tab === 'closed' && (status === 'cancelled' || status === 'rejected'));

const card = (company: CompanyProfile) =>
  omit(company, [
    'about',
    'yearsInBusiness',
    'services',
    'coveredGovernorates',
    'allGovernorates',
    'canRate',
    'myRating',
  ]);

export function createHandlers(db: MockDb, { latency = 400 }: { latency?: number } = {}) {
  /** Realistic latency (spec B2), skipped in unit tests. */
  const wait = () => (latency ? delay(latency) : Promise.resolve());
  const api = (path: string) => `*/api${path}`;
  const body = async <T>(request: Request) => (await request.json().catch(() => ({}))) as T;
  const findOrder = (orderId: string) => db.orders.find((o) => o.id === orderId);
  const findCompany = (companyId: string) => db.companies.find((c) => c.id === companyId);

  return [
    // ── profile & quota ─────────────────────────────────────────────────────
    // The identity itself comes from the real profiles row (services/api/ownProfile.ts):
    // GET /me only provides the mocked avatar, and name/gender updates go to Supabase.
    http.get(api('/me'), async () => (await wait(), ok(db.me))),
    http.post(api('/me/avatar'), async ({ request }) => {
      await wait();
      db.me.avatarUrl = (await body<{ dataUrl: string }>(request)).dataUrl;
      return ok(db.me);
    }),
    ...(['email', 'phone'] as const).flatMap((kind) => [
      http.post(api(`/me/${kind}`), async ({ request }) => {
        await wait();
        const value = (await body<Record<string, string>>(request))[kind] ?? '';
        db.pendingChange = { kind, value };
        return ok(null);
      }),
      http.post(api(`/me/${kind}/confirm`), async ({ request }) => {
        await wait();
        const { code } = await body<{ code: string }>(request);
        if (db.pendingChange?.kind !== kind) return fail(400, 'OTP_EXPIRED');
        if (code !== OTP_DEMO_CODE) return fail(400, 'OTP_INVALID');
        db.me[kind] = db.pendingChange.value;
        db.pendingChange = null;
        return ok(db.me);
      }),
    ]),
    http.get(api('/me/attempts'), async () => (await wait(), ok(db.attempts))),
    http.get(api('/requests/draft'), async () => (await wait(), ok(db.draft))),
    http.delete(api('/requests/draft'), async () => {
      await wait();
      db.draft = null;
      return ok(null);
    }),

    // ── orders ─────────────────────────────────────────────────────────────
    http.get(api('/orders'), async ({ request }) => {
      await wait();
      const params = new URL(request.url).searchParams;
      const tab = (params.get('tab') ?? 'all') as OrderTab;
      const search = (params.get('search') ?? '').trim().toUpperCase();
      const cursor = Number(params.get('cursor') ?? 0);
      const sorted = [...db.orders].sort((a, b) =>
        params.get('sort') === 'oldest'
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt),
      );
      const searched = sorted.filter((o) => !search || o.reference.includes(search));
      const matching = searched.filter((o) => inTab(tab, o.status));
      const counts = Object.fromEntries(
        ORDER_TABS.map((t) => [t, searched.filter((o) => inTab(t, o.status)).length]),
      );
      const items = matching.slice(cursor, cursor + ORDERS_PAGE_SIZE).map(summary);
      const next = cursor + ORDERS_PAGE_SIZE;
      return ok({
        items,
        total: matching.length,
        counts,
        withNewOffers: db.orders.filter((o) => o.newOffers > 0).length,
        nextCursor: next < matching.length ? next : null,
      });
    }),
    http.get(api('/orders/:id'), async ({ params }) => {
      await wait();
      const order = findOrder(String(params.id));
      if (!order) return fail(404, 'NOT_FOUND');
      order.newOffers = 0; // opened
      return ok(order);
    }),
    http.post(api('/orders/:id/cancel'), async ({ params, request }) => {
      await wait();
      const order = findOrder(String(params.id));
      if (!order) return fail(404, 'NOT_FOUND');
      if (!CANCELLABLE_STATUSES.includes(order.status)) return fail(409, 'VALIDATION_ERROR');
      order.status = 'cancelled';
      order.cancelReason = (await body<{ reason?: string }>(request)).reason ?? null;
      order.updatedAt = now();
      return ok(order);
    }),
    http.post(api('/orders/:id/offers/:offerId/accept'), async ({ params }) => {
      await wait();
      const order = findOrder(String(params.id));
      const offer = order?.offers.find((o) => o.id === params.offerId);
      if (!order || !offer) return fail(404, 'NOT_FOUND');
      if (order.status !== 'offers_received' || offer.status !== 'pending') {
        return fail(409, 'VALIDATION_ERROR');
      }
      offer.status = 'selected';
      order.status = 'awaiting_approval';
      order.updatedAt = now();
      order.timeline.push({ step: 'selected', at: now() });
      return ok(order);
    }),
    http.post(api('/orders/:id/offers/:offerId/reject'), async ({ params }) => {
      await wait();
      const offer = findOrder(String(params.id))?.offers.find((o) => o.id === params.offerId);
      if (!offer) return fail(404, 'NOT_FOUND');
      offer.status = 'rejected';
      return ok(findOrder(String(params.id))!);
    }),
    http.post(api('/orders/:id/offers/:offerId/questions'), async () => (await wait(), ok(null))),

    // ── companies ──────────────────────────────────────────────────────────
    http.get(api('/companies'), async ({ request }) => {
      await wait();
      const params = new URL(request.url).searchParams;
      const search = (params.get('search') ?? '').trim().toLowerCase();
      const category = params.get('category');
      const sort = params.get('sort');
      const list = db.companies
        .filter((c) => !search || c.name.toLowerCase().includes(search))
        .filter((c) => !category || c.categories.includes(category as never))
        .sort((a, b) => {
          if (sort === 'name') return a.name.localeCompare(b.name);
          if (sort === 'most_completed') return b.completedOrders - a.completedOrders;
          return b.rating - a.rating;
        });
      return ok(list.map(card));
    }),
    http.get(api('/companies/:id'), async ({ params }) => {
      await wait();
      const company = findCompany(String(params.id));
      return company ? ok(company) : fail(404, 'NOT_FOUND');
    }),
    http.get(api('/companies/:id/reviews'), async ({ params, request }) => {
      await wait();
      const list = [...(db.reviews[String(params.id)] ?? [])];
      const top = new URL(request.url).searchParams.get('sort') === 'top';
      list.sort((a, b) => (top ? b.likes - a.likes : b.createdAt.localeCompare(a.createdAt)));
      return ok(list);
    }),
    http.post(api('/companies/:id/reviews'), async ({ params, request }) => {
      await wait();
      const company = findCompany(String(params.id));
      if (!company) return fail(404, 'NOT_FOUND');
      if (!company.canRate) return fail(403, 'VALIDATION_ERROR');
      const { rating, comment } = await body<{ rating: number; comment?: string }>(request);
      const list = (db.reviews[company.id] ??= []);
      list.unshift({
        id: id('r'),
        author: `${db.me.firstName} ${db.me.lastName.slice(0, 1)}.`,
        rating,
        comment: comment ?? '',
        createdAt: now(),
        likes: 0,
        dislikes: 0,
        myReaction: null,
      });
      const total = company.rating * company.reviewsCount + rating;
      company.reviewsCount += 1;
      company.rating = Math.round((total / company.reviewsCount) * 10) / 10;
      company.myRating = rating;
      return ok(company);
    }),
    http.post(api('/companies/:id/reviews/:reviewId/reaction'), async ({ params, request }) => {
      await wait();
      const review = db.reviews[String(params.id)]?.find((r) => r.id === params.reviewId);
      if (!review) return fail(404, 'NOT_FOUND');
      const { reaction } = await body<{ reaction: 'like' | 'dislike' | null }>(request);
      if (review.myReaction === 'like') review.likes -= 1;
      if (review.myReaction === 'dislike') review.dislikes -= 1;
      if (reaction === 'like') review.likes += 1;
      if (reaction === 'dislike') review.dislikes += 1;
      review.myReaction = reaction;
      return ok(review);
    }),

    // ── notifications ──────────────────────────────────────────────────────
    http.get(api('/notifications'), async () => (await wait(), ok(db.notifications))),
    http.post(api('/notifications/read-all'), async () => {
      await wait();
      db.notifications.forEach((n) => (n.read = true));
      return ok(null);
    }),
    http.post(api('/notifications/:id/read'), async ({ params }) => {
      await wait();
      const item = db.notifications.find((n) => n.id === params.id);
      if (item) item.read = true;
      return ok(null);
    }),

    // ── account ────────────────────────────────────────────────────────────
    http.get(
      api('/account/security'),
      async () => (await wait(), ok({ sessions: db.sessions, activity: db.activity })),
    ),
    http.post(api('/account/password'), async ({ request }) => {
      await wait();
      const { currentPassword } = await body<{ currentPassword: string }>(request);
      // demo rule so the error state can be shown: "wrong" is the wrong password
      return currentPassword === 'wrong' ? fail(400, 'INVALID_CREDENTIALS') : ok(null);
    }),
    http.post(api('/account/sessions/logout-others'), async () => {
      await wait();
      db.sessions = db.sessions.filter((s) => s.current);
      return ok({ sessions: db.sessions, activity: db.activity });
    }),
    http.get(api('/account/notification-preferences'), async () => (await wait(), ok(db.prefs))),
    http.patch(api('/account/notification-preferences'), async ({ request }) => {
      await wait();
      const { event, channel, value } = await body<{
        event: NotificationEvent;
        channel: 'inApp' | 'email';
        value: boolean;
      }>(request);
      if (event !== 'security') db.prefs[event][channel] = value; // security alerts: always on
      return ok(db.prefs);
    }),
    http.get(api('/account/addresses'), async () => (await wait(), ok(db.addresses))),
    http.post(api('/account/addresses'), async ({ request }) => {
      await wait();
      const input = await body<MockDb['addresses'][number]>(request);
      if (input.isDefault || db.addresses.length === 0) {
        db.addresses.forEach((a) => (a.isDefault = false));
        input.isDefault = true;
      }
      db.addresses.push({ ...input, landmark: input.landmark ?? '', id: id('ad') });
      return ok(db.addresses);
    }),
    http.patch(api('/account/addresses/:id'), async ({ params, request }) => {
      await wait();
      const address = db.addresses.find((a) => a.id === params.id);
      if (!address) return fail(404, 'NOT_FOUND');
      const input = await body<MockDb['addresses'][number]>(request);
      if (input.isDefault) db.addresses.forEach((a) => (a.isDefault = false));
      Object.assign(address, input, { landmark: input.landmark ?? '' });
      return ok(db.addresses);
    }),
    http.delete(api('/account/addresses/:id'), async ({ params }) => {
      await wait();
      const removed = db.addresses.find((a) => a.id === params.id);
      db.addresses = db.addresses.filter((a) => a.id !== params.id);
      if (removed?.isDefault && db.addresses[0]) db.addresses[0].isDefault = true;
      return ok(db.addresses);
    }),
    http.post(api('/account/addresses/:id/default'), async ({ params }) => {
      await wait();
      db.addresses.forEach((a) => (a.isDefault = a.id === params.id));
      return ok(db.addresses);
    }),
    http.get(
      api('/account/balance'),
      async () => (await wait(), ok({ ...db.attempts, history: db.balanceHistory })),
    ),
    http.post(api('/account/data-export'), async () => (await wait(), ok(null))),
    http.post(api('/account/delete'), async ({ request }) => {
      await wait();
      const { password } = await body<{ password: string }>(request);
      return password === 'wrong' ? fail(400, 'INVALID_CREDENTIALS') : ok(null);
    }),

    // ── support ────────────────────────────────────────────────────────────
    http.get(
      api('/support/tickets'),
      async () => (await wait(), ok(db.tickets.map((ticket) => omit(ticket, ['messages'])))),
    ),
    http.get(api('/support/tickets/:id'), async ({ params }) => {
      await wait();
      const ticket = db.tickets.find((t) => t.id === params.id);
      return ticket ? ok(ticket) : fail(404, 'NOT_FOUND');
    }),
    http.post(api('/support/tickets'), async ({ request }) => {
      await wait();
      const input = await body<{
        subject: string;
        category: MockDb['tickets'][number]['category'];
        orderReference?: string;
        message: string;
        attachment: { name: string; size: number } | null;
      }>(request);
      const ticket = {
        id: id('tk'),
        reference: `TK-${String(22 + db.tickets.length).padStart(6, '0')}`,
        subject: input.subject,
        category: input.category,
        status: 'open' as const,
        orderReference: input.orderReference ?? null,
        updatedAt: now(),
        messages: [
          {
            id: id('m'),
            from: 'customer' as const,
            body: input.message,
            at: now(),
            attachment: input.attachment,
          },
        ],
      };
      db.tickets.unshift(ticket);
      return ok(ticket, 201);
    }),
    http.post(api('/support/tickets/:id/messages'), async ({ params, request }) => {
      await wait();
      const ticket = db.tickets.find((t) => t.id === params.id);
      if (!ticket) return fail(404, 'NOT_FOUND');
      const { message } = await body<{ message: string }>(request);
      ticket.messages.push({
        id: id('m'),
        from: 'customer',
        body: message,
        at: now(),
        attachment: null,
      });
      ticket.status = ticket.status === 'resolved' ? 'open' : ticket.status;
      ticket.updatedAt = now();
      return ok(ticket);
    }),
  ];
}
