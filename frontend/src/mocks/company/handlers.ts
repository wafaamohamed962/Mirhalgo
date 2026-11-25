import { delay, http, HttpResponse, type JsonBodyType } from 'msw';
import type { z } from 'zod';
import {
  OVERVIEW_LIMITS,
  TEMPLATE_OF,
  categoryOf,
  changePasswordSchema,
  companyContactSchema,
  inquiryReplySchema,
  offerInputSchema,
  offerPrivacySchema,
  toCompanyOrder,
  type ApiError,
  type CompanyAccount,
  type CompanyDashboard,
  type CompanyInquiry,
  type CompanyOffer,
  type CompanyRequest,
  type CompanyRequestDetails,
  type CompetitorComparison,
  type CompetitorRow,
  type ErrorCode,
  type OfferSubmissionStatus,
} from '@mirhalgo/shared';
import { logActivity, type CompanyState, type CompanyStore } from './db';
import { COMPANIES, SELF_ID, type MockCompanyOrder, type MockOffer } from './fixtures';

/*
 * MSW handlers for the company portal (MW_004 B1, spec B12). They behave like the future
 * backend, including its privacy rules:
 * - orders never carry client contact data (toCompanyOrder, shared with the API);
 * - competitor offers have no company id, name or alias, only a number within the order;
 * - offers of companies that hide them are never returned, only counted.
 * The caller is the logged-in company (Bearer token): each account has its own state.
 */

const ok = (data: JsonBodyType, status = 200) => HttpResponse.json({ ok: true, data }, { status });
const fail = (status: number, code: ErrorCode) =>
  HttpResponse.json<ApiError>({ ok: false, error: { code, message: code } }, { status });

/** The token's claims. supabase-js tokens are JWTs; the mock only reads them (no signature). */
function claims(request: Request): { sub: string; email: string; role: unknown } | null {
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
  const payload = token?.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      sub?: string;
      email?: string;
      app_metadata?: { role?: unknown };
    };
    return json.sub
      ? { sub: json.sub, email: json.email ?? '', role: json.app_metadata?.role }
      : null;
  } catch {
    return null;
  }
}

const hiddenCompanies = new Set<string>(COMPANIES.filter((c) => c.hideOffers).map((c) => c.id));
const newest = <T extends { createdAt: string }>(list: T[]) =>
  [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export function createCompanyHandlers(
  store: CompanyStore,
  { latency = 400 }: { latency?: number } = {},
) {
  const wait = () => (latency ? delay(latency) : Promise.resolve());
  const api = (path: string) => `*/api/company${path}`;

  type Ctx = { state: CompanyState; accountId: string; email: string };

  /** Auth like the real API (401 / 403), then the account's state. */
  const route =
    (
      handler: (
        ctx: Ctx,
        request: Request,
        params: Record<string, string>,
      ) => Promise<Response> | Response,
    ) =>
    async ({
      request,
      params,
    }: {
      request: Request;
      params: Record<string, string | readonly string[] | undefined>;
    }) => {
      await wait();
      const who = claims(request);
      if (!who) return fail(401, 'UNAUTHORIZED');
      if (who.role !== 'company') return fail(403, 'FORBIDDEN');
      const ctx = { state: store.load(who.sub), accountId: who.sub, email: who.email };
      return handler(ctx, request, params as Record<string, string>);
    };

  /** Parses the JSON body with a shared schema (400 VALIDATION_ERROR, like validateBody). */
  async function parse<S extends z.ZodTypeAny>(request: Request, schema: S) {
    const body: unknown = await request.json().catch(() => undefined);
    const result = schema.safeParse(body);
    return result.success ? (result.data as z.output<S>) : null;
  }

  // ── views (what the company may see) ─────────────────────────────────────────────────────

  const ours = (state: CompanyState, orderId?: string) =>
    state.offers.filter((o) => o.companyId === SELF_ID && (!orderId || o.orderId === orderId));
  const isAssigned = (order: MockCompanyOrder) => order.assignedTo.includes(SELF_ID);
  /** Assigned to us, or we have offered: the orders a company can open. */
  const visibleOrder = (state: CompanyState, orderId: string) => {
    const order = state.orders.find((o) => o.id === orderId);
    return order && (isAssigned(order) || ours(state, orderId).length > 0) ? order : undefined;
  };

  const offerView = (state: CompanyState, offer: MockOffer): CompanyOffer => {
    const order = state.orders.find((o) => o.id === offer.orderId)!;
    return {
      id: offer.id,
      orderId: offer.orderId,
      category: categoryOf(order.order),
      template: offer.template,
      status: offer.status,
      details: offer.details,
      total: offer.total,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
      rejectionReason: offer.rejectionReason,
    };
  };
  const offerRef = ({ id, status, total }: MockOffer) => ({ id, status, total });

  const requestView = (state: CompanyState, order: MockCompanyOrder): CompanyRequest => ({
    id: order.id,
    category: categoryOf(order.order),
    service: order.order.service,
    createdAt: order.createdAt,
    status: order.status,
    offersCount: state.offers.filter((o) => o.orderId === order.id).length,
    ourOffersCount: ours(state, order.id).length,
  });

  const others = (state: CompanyState, orderId: string) =>
    state.offers.filter((o) => o.orderId === orderId && o.companyId !== SELF_ID);

  /** Competitors as "#N" (numbered by their first offer on this order), hidden ones counted. */
  function comparison(state: CompanyState, order: MockCompanyOrder): CompetitorComparison {
    const theirs = others(state, order.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const visible = theirs.filter((o) => !hiddenCompanies.has(o.companyId));
    const labels = new Map<string, number>();
    for (const offer of visible)
      if (!labels.has(offer.companyId)) labels.set(offer.companyId, labels.size + 1);
    return {
      orderId: order.id,
      category: categoryOf(order.order),
      ours: newest(ours(state, order.id)).map((o) => offerView(state, o)),
      competitors: visible.map((o) => ({
        label: labels.get(o.companyId)!,
        status: o.status,
        template: o.template,
        createdAt: o.createdAt,
        total: o.total,
      })),
      hiddenCount: new Set(
        theirs.filter((o) => hiddenCompanies.has(o.companyId)).map((o) => o.companyId),
      ).size,
    };
  }

  const inquiryView = (
    state: CompanyState,
    inquiry: CompanyState['inquiries'][number],
  ): CompanyInquiry => {
    const order = state.orders.find((o) => o.id === inquiry.orderId)!;
    return {
      ...inquiry,
      category: categoryOf(order.order),
      status: inquiry.reply ? 'replied' : 'awaiting_reply',
      ours: newest(ours(state, order.id)).map(offerRef),
    };
  };

  const account = ({ state, accountId, email }: Ctx): CompanyAccount => {
    const self = COMPANIES[0];
    return {
      id: accountId,
      legalName: self.legalName,
      alias: self.alias,
      email,
      contactEmail: state.settings.contactEmail ?? email,
      contactPhone: state.settings.contactPhone,
      activities: ['international'],
      internationalScope: 'both',
      accountStatus: 'approved',
      offerSubmission: state.settings.offerSubmission,
      hideOffers: state.settings.hideOffers,
    };
  };

  const availableRequests = (state: CompanyState) =>
    newest(state.orders.filter(isAssigned)).map((o) => requestView(state, o));

  function dashboard(state: CompanyState): CompanyDashboard {
    const mine = ours(state);
    const requests = availableRequests(state);
    const awaitingOffer = requests.filter((r) => r.status === 'open' && r.ourOffersCount === 0);
    const inquiries = newest(state.inquiries).map((i) => inquiryView(state, i));
    const awaitingInquiries = inquiries.filter((i) => i.status === 'awaiting_reply');
    // hours from assignment to our first offer, per order
    const firstOffer = new Map<string, number>();
    for (const offer of mine) {
      const at = Date.parse(offer.createdAt);
      firstOffer.set(offer.orderId, Math.min(firstOffer.get(offer.orderId) ?? at, at));
    }
    const hours = [...firstOffer].map(([orderId, at]) => {
      const order = state.orders.find((o) => o.id === orderId)!;
      return (at - Date.parse(order.assignedAt)) / 3_600_000;
    });
    const accepted = mine.filter((o) => o.status === 'accepted');
    return {
      kpis: {
        offersSubmitted: mine.length,
        offersAccepted: accepted.length,
        offersRejected: mine.filter((o) => o.status === 'rejected').length,
        completedOrders: accepted.filter(
          (o) => state.orders.find((order) => order.id === o.orderId)?.status === 'completed',
        ).length,
        avgResponseHours: hours.length
          ? Math.round((hours.reduce((sum, h) => sum + h, 0) / hours.length) * 10) / 10
          : null,
        onTimeRate: state.onTimeRate,
      },
      counts: {
        requestsWithoutOffer: awaitingOffer.length,
        offersUnderReview: mine.filter((o) => o.status === 'under_review').length,
        inquiriesAwaiting: awaitingInquiries.length,
      },
      awaitingOffer: awaitingOffer.slice(0, OVERVIEW_LIMITS.awaitingOffer),
      latestOffers: newest(mine)
        .slice(0, OVERVIEW_LIMITS.latestOffers)
        .map((o) => offerView(state, o)),
      awaitingInquiries: awaitingInquiries.slice(0, OVERVIEW_LIMITS.inquiries),
      activity: state.activity.slice(0, OVERVIEW_LIMITS.activity),
    };
  }

  /** Shared checks of submit and edit: suspension, valid body, the order's template. */
  async function offerBody(state: CompanyState, request: Request, order: MockCompanyOrder) {
    if (state.settings.offerSubmission === 'suspended')
      return fail(403, 'OFFER_SUBMISSION_SUSPENDED');
    const input = await parse(request, offerInputSchema);
    if (!input || input.template !== TEMPLATE_OF[categoryOf(order.order)]) {
      return fail(400, 'VALIDATION_ERROR');
    }
    return input;
  }

  return [
    http.get(
      api('/me'),
      route((ctx) => ok(account(ctx))),
    ),

    http.get(
      api('/dashboard'),
      route(({ state }) => ok(dashboard(state))),
    ),

    http.get(
      api('/requests'),
      route(({ state }) => ok(availableRequests(state))),
    ),

    http.get(
      api('/requests/:id'),
      route(({ state }, _request, { id }) => {
        const order = visibleOrder(state, id!);
        if (!order) return fail(404, 'NOT_FOUND');
        const details: CompanyRequestDetails = {
          ...requestView(state, order),
          order: toCompanyOrder(order.order),
          attachments: order.attachments,
        };
        return ok(details);
      }),
    ),

    http.post(
      api('/requests/:id/offers'),
      route(async (ctx, request, { id }) => {
        const { state } = ctx;
        const order = state.orders.find((o) => o.id === id);
        if (!order || !isAssigned(order)) return fail(404, 'NOT_FOUND');
        if (order.status !== 'open') return fail(409, 'ORDER_NOT_OPEN');
        const input = await offerBody(state, request, order);
        if (input instanceof Response) return input;
        const at = new Date().toISOString();
        state.seq.offer += 1;
        const offer: MockOffer = {
          ...input,
          id: `OF-${state.seq.offer}`,
          orderId: order.id,
          companyId: SELF_ID,
          status: 'under_review',
          createdAt: at,
          updatedAt: at,
          rejectionReason: null,
        };
        state.offers.push(offer);
        logActivity(state, { type: 'offer_submitted', orderId: order.id, offerId: offer.id });
        store.save(ctx.accountId);
        return ok(offerView(state, offer), 201);
      }),
    ),

    http.get(
      api('/offers'),
      route(({ state }) => ok(newest(ours(state)).map((o) => offerView(state, o)))),
    ),

    http.patch(
      api('/offers/:id'),
      route(async (ctx, request, { id }) => {
        const { state } = ctx;
        const offer = ours(state).find((o) => o.id === id);
        if (!offer) return fail(404, 'NOT_FOUND');
        if (offer.status !== 'under_review') return fail(409, 'OFFER_NOT_EDITABLE');
        const order = state.orders.find((o) => o.id === offer.orderId)!;
        const input = await offerBody(state, request, order);
        if (input instanceof Response) return input;
        // the status stays "under review" (spec B5)
        Object.assign(offer, {
          details: input.details,
          total: input.total,
          updatedAt: new Date().toISOString(),
        });
        logActivity(state, { type: 'offer_updated', orderId: offer.orderId, offerId: offer.id });
        store.save(ctx.accountId);
        return ok(offerView(state, offer));
      }),
    ),

    http.get(
      api('/competitors'),
      route(({ state }) => {
        const rows: CompetitorRow[] = newest(
          state.orders.filter((o) => visibleOrder(state, o.id) && others(state, o.id).length > 0),
        ).map((order) => {
          const view = comparison(state, order);
          return {
            orderId: order.id,
            category: view.category,
            service: order.order.service,
            ours: view.ours.map(({ id, status, total }) => ({ id, status, total })),
            visibleCount: view.competitors.length,
            hiddenCount: view.hiddenCount,
          };
        });
        return ok(rows);
      }),
    ),

    http.get(
      api('/competitors/:orderId'),
      route(({ state }, _request, { orderId }) => {
        const order = visibleOrder(state, orderId!);
        return order ? ok(comparison(state, order)) : fail(404, 'NOT_FOUND');
      }),
    ),

    http.get(
      api('/inquiries'),
      route(({ state }) => ok(newest(state.inquiries).map((i) => inquiryView(state, i)))),
    ),

    http.post(
      api('/inquiries/:id/reply'),
      route(async (ctx, request, { id }) => {
        const { state } = ctx;
        const inquiry = state.inquiries.find((i) => i.id === id);
        if (!inquiry) return fail(404, 'NOT_FOUND');
        // a reply is final and read-only (spec B8: the demo let it be overwritten)
        if (inquiry.reply) return fail(409, 'INQUIRY_ALREADY_REPLIED');
        const input = await parse(request, inquiryReplySchema);
        if (!input) return fail(400, 'VALIDATION_ERROR');
        inquiry.reply = { text: input.reply, sentAt: new Date().toISOString() };
        logActivity(state, {
          type: 'inquiry_replied',
          orderId: inquiry.orderId,
          inquiryId: inquiry.id,
        });
        store.save(ctx.accountId);
        return ok(inquiryView(state, inquiry));
      }),
    ),

    http.patch(
      api('/settings/contact'),
      route(async (ctx, request) => {
        const input = await parse(request, companyContactSchema);
        if (!input) return fail(400, 'VALIDATION_ERROR');
        Object.assign(ctx.state.settings, input);
        logActivity(ctx.state, { type: 'contact_updated' });
        store.save(ctx.accountId);
        return ok(account(ctx));
      }),
    ),

    http.patch(
      api('/settings/privacy'),
      route(async (ctx, request) => {
        const input = await parse(request, offerPrivacySchema);
        if (!input) return fail(400, 'VALIDATION_ERROR');
        ctx.state.settings.hideOffers = input.hideOffers;
        logActivity(ctx.state, { type: 'privacy_changed', hideOffers: input.hideOffers });
        store.save(ctx.accountId);
        return ok(account(ctx));
      }),
    ),

    http.post(
      api('/settings/password'),
      route(async (ctx, request) => {
        const input = await parse(request, changePasswordSchema);
        if (!input) return fail(400, 'VALIDATION_ERROR');
        // mocked in this task (spec B9); "wrong" is the demo's wrong current password
        if (input.currentPassword === 'wrong') return fail(400, 'INVALID_CREDENTIALS');
        logActivity(ctx.state, { type: 'password_changed' });
        store.save(ctx.accountId);
        return ok(null);
      }),
    ),

    // ── demo tools: mock only, never part of the real API (dev / staging, plan Q11) ─────────

    http.post(
      api('/demo/reset'),
      route(({ accountId }) => {
        store.reset(accountId);
        return ok(null);
      }),
    ),

    http.patch(
      api('/demo/offer-submission'),
      route(async (ctx, request) => {
        const body = (await request.json().catch(() => ({}))) as { status?: OfferSubmissionStatus };
        if (body.status !== 'allowed' && body.status !== 'suspended')
          return fail(400, 'VALIDATION_ERROR');
        ctx.state.settings.offerSubmission = body.status;
        store.save(ctx.accountId);
        return ok(account(ctx));
      }),
    ),
  ];
}
