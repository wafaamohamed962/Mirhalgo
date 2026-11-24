import type { ActivityEntry, OfferSubmissionStatus } from '@mirhalgo/shared';
import { buildFixtures, SELF_DEFAULTS, SELF_ID } from './fixtures';

/*
 * Company portal mock state (MW_004 B1). Unlike the customer mocks (in memory), it persists
 * in localStorage PER ACCOUNT, so the demo survives a refresh (spec B1). A fixture change
 * bumps STATE_VERSION, which starts every account again. "Reset demo data" deletes it.
 */

const STATE_VERSION = 1;
const KEY_PREFIX = `mirhalgo.companyDemo.v${STATE_VERSION}.`;

/** localStorage, or an in-memory stand-in in tests. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createCompanyState(now = Date.now()) {
  const data = buildFixtures(now);
  return {
    version: STATE_VERSION,
    settings: {
      /** null → the login email (known only from the session). */
      contactEmail: null as string | null,
      contactPhone: SELF_DEFAULTS.contactPhone,
      hideOffers: SELF_DEFAULTS.hideOffers,
      offerSubmission: SELF_DEFAULTS.offerSubmission as OfferSubmissionStatus,
    },
    onTimeRate: SELF_DEFAULTS.onTimeRate,
    orders: data.orders,
    offers: data.offers,
    inquiries: data.inquiries,
    activity: initialActivity(data),
    /** Counters: ids are never derived from list lengths (spec B5). */
    seq: { offer: data.offerSeq, inquiry: data.inquirySeq, activity: 0 },
  };
}

export type CompanyState = ReturnType<typeof createCompanyState>;

/** The log the fixtures imply (assignments, our offers and their outcome, inquiries). */
function initialActivity(data: ReturnType<typeof buildFixtures>): ActivityEntry[] {
  const entries: Array<Omit<ActivityEntry, 'id'>> = [];
  for (const order of data.orders) {
    if (order.assignedTo.includes(SELF_ID)) {
      entries.push({ type: 'request_assigned', at: order.assignedAt, orderId: order.id });
    }
  }
  for (const offer of data.offers.filter((o) => o.companyId === SELF_ID)) {
    entries.push({
      type: 'offer_submitted',
      at: offer.createdAt,
      orderId: offer.orderId,
      offerId: offer.id,
    });
    if (offer.status !== 'under_review') {
      const decidedAt = new Date(Date.parse(offer.createdAt) + 24 * 3_600_000).toISOString();
      entries.push({
        type: offer.status === 'accepted' ? 'offer_accepted' : 'offer_rejected',
        at: decidedAt,
        orderId: offer.orderId,
        offerId: offer.id,
      });
    }
  }
  for (const inquiry of data.inquiries) {
    entries.push({
      type: 'inquiry_received',
      at: inquiry.createdAt,
      orderId: inquiry.orderId,
      inquiryId: inquiry.id,
    });
    if (inquiry.reply) {
      entries.push({
        type: 'inquiry_replied',
        at: inquiry.reply.sentAt,
        orderId: inquiry.orderId,
        inquiryId: inquiry.id,
      });
    }
  }
  const now = Date.now();
  return entries
    .filter((entry) => Date.parse(entry.at) <= now)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((entry, i) => ({ ...entry, id: `ACT-${String(entries.length - i).padStart(6, '0')}` }));
}

/** Adds a log entry (newest first) with a counter id. */
export function logActivity(state: CompanyState, entry: Omit<ActivityEntry, 'id' | 'at'>) {
  state.seq.activity += 1;
  state.activity.unshift({
    ...entry,
    id: `ACT-${String(10_000 + state.seq.activity).padStart(6, '0')}`,
    at: new Date().toISOString(),
  });
}

/**
 * One state per account (the user id from the session), loaded on first use and saved after
 * every change.
 */
export function createCompanyStore(storage: KeyValueStorage = window.localStorage) {
  const cache = new Map<string, CompanyState>();
  const key = (accountId: string) => KEY_PREFIX + accountId;

  const load = (accountId: string): CompanyState => {
    const cached = cache.get(accountId);
    if (cached) return cached;
    let state: CompanyState | null = null;
    try {
      const raw = storage.getItem(key(accountId));
      const parsed = raw ? (JSON.parse(raw) as CompanyState) : null;
      state = parsed?.version === STATE_VERSION ? parsed : null;
    } catch {
      state = null; // unreadable → start again
    }
    state ??= createCompanyState();
    cache.set(accountId, state);
    storage.setItem(key(accountId), JSON.stringify(state));
    return state;
  };

  return {
    load,
    save(accountId: string) {
      const state = cache.get(accountId);
      if (state) storage.setItem(key(accountId), JSON.stringify(state));
    },
    /** "Reset demo data" (dev / staging only, spec B1). */
    reset(accountId: string) {
      cache.delete(accountId);
      storage.removeItem(key(accountId));
    },
  };
}

export type CompanyStore = ReturnType<typeof createCompanyStore>;
