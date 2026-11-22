/**
 * Customer portal API contract (MW_002 Part B). The web app is built against these shapes
 * with MSW mocks; the real API (later plans) must return exactly the same ones, so
 * switching means only removing the mocks. Dates are ISO strings, money is EGP.
 */
import type { Gender } from './schemas/auth.js';
import type { Governorate } from './company.js';

export const SERVICE_TYPES = ['international', 'domestic', 'china'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

/** Request quota (spec B3): the "X of 5" total shown to the customer. */
export const MAX_REQUEST_ATTEMPTS = 5;
/** Requests granted when a customer verifies the email (MW_003 B7, backfilled for MW_001 users). */
export const INITIAL_REQUEST_BALANCE = 5;
/** "Send to all companies in this category": max companies per request (decision 19). */
export const MAX_COMPANIES_PER_REQUEST = 10;

// ── profile ────────────────────────────────────────────────────────────────

export type Me = {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  email: string;
  phone: string;
  avatarUrl: string | null;
};

// ── requests & orders ──────────────────────────────────────────────────────

export type Attempts = { remaining: number; total: number };

export type RequestDraft = { service: ServiceType; updatedAt: string };

/**
 * GET /api/me/summary (MW_003 B2, real API): what the New Request page needs in one call.
 * `drafts`: one per service with a saved draft (B3), most recent first.
 */
export type MeSummary = {
  firstName: string;
  gender: Gender;
  balance: Attempts;
  drafts: RequestDraft[];
};

export const ORDER_STATUSES = [
  'awaiting_offers',
  'offers_received',
  'awaiting_approval',
  'in_progress',
  'completed',
  'cancelled',
  'rejected',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** List tabs (spec B4). `closed` = cancelled or rejected. */
export const ORDER_TABS = [
  'all',
  'awaiting_offers',
  'offers_received',
  'awaiting_approval',
  'in_progress',
  'completed',
  'closed',
] as const;
export type OrderTab = (typeof ORDER_TABS)[number];

/** The customer can cancel only before an offer is approved. */
export const CANCELLABLE_STATUSES: readonly OrderStatus[] = ['awaiting_offers', 'offers_received'];

export type OrderSummary = {
  id: string;
  reference: string;
  service: ServiceType;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  offersCount: number;
  /** Offers the customer has not opened yet (sidebar badge). */
  newOffers: number;
};

export const TIMELINE_STEPS = [
  'submitted',
  'under_review',
  'offers_received',
  'selected',
  'approved',
  'in_progress',
  'completed',
] as const;
export type TimelineStep = (typeof TIMELINE_STEPS)[number];

export type OfferStatus = 'pending' | 'selected' | 'approved' | 'rejected';

/** Offers are anonymous: "MirhalGo Partner #001" (spec B4). */
export type Offer = {
  id: string;
  partnerNumber: number;
  totalCost: number;
  currency: 'EGP';
  transitDays: number;
  validUntil: string;
  /** i18n keys under `portal.offers.includes.*`. */
  includes: string[];
  notes: string;
  status: OfferStatus;
};

export type OrderDetails = OrderSummary & {
  /** Submitted data: `field` is an i18n key under `portal.orderFields.*`. */
  details: Array<{ field: string; value: string }>;
  offers: Offer[];
  timeline: Array<{ step: TimelineStep; at: string }>;
  cancelReason: string | null;
};

export type OrderList = {
  items: OrderSummary[];
  nextCursor: number | null;
  total: number;
  counts: Record<OrderTab, number>;
  /** Orders with offers the customer has not opened yet (sidebar badge, spec B1). */
  withNewOffers: number;
};

export type OrderListParams = {
  tab: OrderTab;
  search: string;
  sort: 'newest' | 'oldest';
  cursor: number;
};

// ── companies directory ────────────────────────────────────────────────────

export const COMPANY_CATEGORIES = ['international', 'customs', 'china', 'domestic'] as const;
export type CompanyCategory = (typeof COMPANY_CATEGORIES)[number];

export const COMPANY_SORTS = ['top_rated', 'most_completed', 'name'] as const;
export type CompanySort = (typeof COMPANY_SORTS)[number];

export type CompanyCard = {
  id: string;
  /** Hidden by the UI when company identity is off (pending product decision, spec B5). */
  name: string;
  logoUrl: string | null;
  categories: CompanyCategory[];
  rating: number;
  reviewsCount: number;
  completedOrders: number;
  topRated: boolean;
};

export type CompanyProfile = CompanyCard & {
  about: string;
  yearsInBusiness: number;
  /** i18n keys under `portal.companyServices.*`. */
  services: string[];
  /** Empty with `allGovernorates` = covers all of Egypt. */
  coveredGovernorates: Governorate[];
  allGovernorates: boolean;
  /** True only if this company completed an order for the customer (spec B5). */
  canRate: boolean;
  myRating: number | null;
};

export type Review = {
  id: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
  likes: number;
  dislikes: number;
  myReaction: 'like' | 'dislike' | null;
};

// ── notifications ──────────────────────────────────────────────────────────

export const NOTIFICATION_EVENTS = [
  'new_offer',
  'order_status',
  'question_reply',
  'security',
  'news',
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export type AppNotification = {
  id: string;
  event: NotificationEvent;
  /** Interpolation values for `portal.notifications.text.<event>`. */
  params: Record<string, string>;
  createdAt: string;
  read: boolean;
  /** In-app path the item opens. */
  link: string;
};

export type NotificationPrefs = Record<NotificationEvent, { inApp: boolean; email: boolean }>;

// ── account ────────────────────────────────────────────────────────────────

export type DeviceSession = {
  id: string;
  device: string;
  browser: string;
  location: string;
  lastActive: string;
  current: boolean;
};

export type LoginActivity = {
  id: string;
  at: string;
  device: string;
  location: string;
  success: boolean;
};

export type SecurityOverview = { sessions: DeviceSession[]; activity: LoginActivity[] };

export type Address = {
  id: string;
  label: string;
  governorate: Governorate;
  city: string;
  street: string;
  landmark: string;
  phone: string;
  isDefault: boolean;
};

export type BalanceEntry = {
  id: string;
  at: string;
  orderReference: string | null;
  type: 'request' | 'refund' | 'bonus';
  before: number;
  after: number;
  /** i18n key under `portal.balance.reasons.*`. */
  reason: string;
};

export type Balance = Attempts & { history: BalanceEntry[] };

// ── support ────────────────────────────────────────────────────────────────

export const TICKET_CATEGORIES = ['order', 'offer', 'payment', 'account', 'other'] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketStatus = 'open' | 'in_progress' | 'resolved';

export type TicketMessage = {
  id: string;
  from: 'customer' | 'support';
  body: string;
  at: string;
  attachment: { name: string; size: number } | null;
};

export type TicketSummary = {
  id: string;
  reference: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  orderReference: string | null;
  updatedAt: string;
};

export type Ticket = TicketSummary & { messages: TicketMessage[] };
