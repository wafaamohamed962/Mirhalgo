import type { CompanyStatus } from './api.js';
import type { CompanyActivity, InternationalScope } from './company.js';
import type { ChinaOrder, DomesticOrder, InternationalOrder, Order } from './schemas/orders.js';
import type { OfferDetails, OfferTotal } from './schemas/companyPortal.js';

/*
 * Company portal contract (MW_004 B1, spec B12). The MSW mocks answer with these shapes now;
 * the real API will return the same, so connecting it only means removing the mocks.
 * Privacy rules live here too (toCompanyOrder, CompetitorOffer), so the mock and the future
 * API share them.
 */

// ── categories and offer templates (spec B2, B5) ─────────────────────────────────────────

/** Service categories, each with its own icon and colour in every list. */
export const SERVICE_CATEGORIES = [
  'sea',
  'international_land',
  'domestic_land',
  'air',
  'shein',
  'chinese_sites',
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

/** The category of an order: international by mode, domestic land, China by source. */
export function categoryOf(order: Order | CompanyOrder): ServiceCategory {
  if (order.service === 'domestic') return 'domestic_land';
  if (order.service === 'china') return order.order.source === 'shein' ? 'shein' : 'chinese_sites';
  const { mode } = order.shipment;
  return mode === 'land' ? 'international_land' : mode;
}

/** The offer form follows the category; SHEIN and Chinese sites share one template. */
export const OFFER_TEMPLATES = [
  'sea',
  'international_land',
  'domestic_land',
  'air',
  'china',
] as const;
export type OfferTemplate = (typeof OFFER_TEMPLATES)[number];

export const TEMPLATE_OF: Record<ServiceCategory, OfferTemplate> = {
  sea: 'sea',
  international_land: 'international_land',
  domestic_land: 'domestic_land',
  air: 'air',
  shein: 'china',
  chinese_sites: 'china',
};

/** Total cost: foreign (USD / EUR) and/or EGP, or EGP only (spec B5). */
export const TOTAL_KIND: Record<OfferTemplate, 'dual' | 'egp'> = {
  sea: 'dual',
  international_land: 'dual',
  domestic_land: 'egp',
  air: 'dual',
  china: 'egp',
};
export const FOREIGN_CURRENCIES = ['USD', 'EUR'] as const;
export type ForeignCurrency = (typeof FOREIGN_CURRENCIES)[number];

// ── statuses and ids ─────────────────────────────────────────────────────────────────

/** An order as companies see it: open for offers, an offer accepted, done, or cancelled. */
export const COMPANY_ORDER_STATUSES = ['open', 'awarded', 'completed', 'cancelled'] as const;
export type CompanyOrderStatus = (typeof COMPANY_ORDER_STATUSES)[number];

export const COMPANY_OFFER_STATUSES = ['under_review', 'accepted', 'rejected'] as const;
export type CompanyOfferStatus = (typeof COMPANY_OFFER_STATUSES)[number];

export const INQUIRY_STATUSES = ['awaiting_reply', 'replied'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

/** Set by the administration (spec B5, B9): `suspended` blocks new offers. */
export const OFFER_SUBMISSION_STATUSES = ['allowed', 'suspended'] as const;
export type OfferSubmissionStatus = (typeof OFFER_SUBMISSION_STATUSES)[number];

/** Unique ids from a counter, never from a list length (the demo's ids could collide). */
export const OFFER_ID_PATTERN = /^OF-\d{6}$/;
export const INQUIRY_ID_PATTERN = /^IQ-\d{6}$/;

/** Shown on the overview (spec B3). */
export const OVERVIEW_LIMITS = { awaitingOffer: 8, latestOffers: 5, inquiries: 5, activity: 10 };

// ── privacy (spec B1) ───────────────────────────────────────────────────────────────

type ClientType = Order['contact']['clientType'];

/**
 * An order without anything that identifies or reaches the client: the contact block (name,
 * phone, WhatsApp, business name) and, for China orders, the receiver's name and phone. Only
 * the client type stays. Companies talk to the client through the platform (spec B1, B4).
 */
export type CompanyOrder =
  | (Omit<InternationalOrder, 'contact'> & { clientType: ClientType })
  | (Omit<DomesticOrder, 'contact'> & { clientType: ClientType })
  | (Omit<ChinaOrder, 'contact' | 'delivery'> & {
      clientType: ClientType;
      delivery: Omit<ChinaOrder['delivery'], 'receiverName' | 'receiverPhone'>;
    });

/** The ONE place contact data is removed: mock handlers now, the API later. */
export function toCompanyOrder(order: Order): CompanyOrder {
  const { contact, ...rest } = order;
  const clientType = contact.clientType;
  if (rest.service !== 'china') return { ...rest, clientType };
  const { receiverName: _name, receiverPhone: _phone, ...delivery } = rest.delivery;
  return { ...rest, delivery, clientType };
}

// ── responses (spec B12) ───────────────────────────────────────────────────────────────

/** GET /api/company/me: the company's own identity and portal settings. */
export type CompanyAccount = {
  id: string;
  legalName: string;
  /** Short display name ("الناقل الذهبي"); null → the legal name is shown. */
  alias: string | null;
  /** Login email (read-only here). */
  email: string;
  contactEmail: string;
  contactPhone: string;
  activities: CompanyActivity[];
  internationalScope: InternationalScope | null;
  accountStatus: CompanyStatus;
  offerSubmission: OfferSubmissionStatus;
  hideOffers: boolean;
};

/** A request in a list (available requests, the overview). */
export type CompanyRequest = {
  id: string;
  category: ServiceCategory;
  service: Order['service'];
  createdAt: string;
  status: CompanyOrderStatus;
  /** Every offer on the order, ours and hidden ones included. */
  offersCount: number;
  ourOffersCount: number;
};

/** GET /api/company/requests/:id: the order without contact data (privacy notice in the UI). */
export type CompanyRequestDetails = CompanyRequest & {
  order: CompanyOrder;
  /** File names only: downloads are not part of the mock. */
  attachments: Array<{ name: string; slot: string }>;
};

export type CompanyOffer = {
  id: string;
  orderId: string;
  category: ServiceCategory;
  template: OfferTemplate;
  status: CompanyOfferStatus;
  details: OfferDetails;
  total: OfferTotal;
  createdAt: string;
  updatedAt: string;
  /** Rejected offers only. */
  rejectionReason: string | null;
};

/** Another company's offer: no id, name or alias, just a number within this order. */
export type CompetitorOffer = {
  /** "Competitor company #label", stable within the order (first offer time). */
  label: number;
  status: CompanyOfferStatus;
  template: OfferTemplate;
  createdAt: string;
  total: OfferTotal;
};

/** GET /api/company/competitors/:orderId (also the comparison from Available requests). */
export type CompetitorComparison = {
  orderId: string;
  category: ServiceCategory;
  ours: CompanyOffer[];
  competitors: CompetitorOffer[];
  /** Companies that hide their offers: counted, never returned. */
  hiddenCount: number;
};

/** GET /api/company/competitors: one row per order with other companies' offers. */
export type CompetitorRow = {
  orderId: string;
  category: ServiceCategory;
  service: Order['service'];
  ours: Array<Pick<CompanyOffer, 'id' | 'status' | 'total'>>;
  visibleCount: number;
  hiddenCount: number;
};

export type CompanyInquiry = {
  id: string;
  orderId: string;
  category: ServiceCategory;
  status: InquiryStatus;
  question: string;
  createdAt: string;
  /** Read-only once sent (spec B8 change from the demo). */
  reply: { text: string; sentAt: string } | null;
  ours: Array<Pick<CompanyOffer, 'id' | 'status' | 'total'>>;
};

export const ACTIVITY_TYPES = [
  'offer_submitted',
  'offer_updated',
  'offer_accepted',
  'offer_rejected',
  'inquiry_received',
  'inquiry_replied',
  'request_assigned',
  'privacy_changed',
  'contact_updated',
  'password_changed',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type ActivityEntry = {
  id: string;
  type: ActivityType;
  at: string;
  orderId?: string;
  offerId?: string;
  inquiryId?: string;
  /** privacy_changed: the new value of "hide our offers". */
  hideOffers?: boolean;
};

export type CompanyKpis = {
  offersSubmitted: number;
  offersAccepted: number;
  offersRejected: number;
  completedOrders: number;
  /** Hours from assignment to our first offer, averaged; null without offers. */
  avgResponseHours: number | null;
  /** 0–100; null without delivered orders. */
  onTimeRate: number | null;
};

/** The sidebar badges (spec B2). */
export type CompanyCounts = {
  requestsWithoutOffer: number;
  offersUnderReview: number;
  inquiriesAwaiting: number;
};

/** GET /api/company/dashboard (spec B3). Lists are already limited (OVERVIEW_LIMITS). */
export type CompanyDashboard = {
  kpis: CompanyKpis;
  counts: CompanyCounts;
  awaitingOffer: CompanyRequest[];
  latestOffers: CompanyOffer[];
  awaitingInquiries: CompanyInquiry[];
  activity: ActivityEntry[];
};
