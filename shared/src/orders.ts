/**
 * New Request orders (MW_003 B3–B5, B8): the fixed option lists of the three forms. Each list is
 * also a Postgres enum (migration …000006), so never rename an id without a migration. Labels
 * live in the web i18n files. Reference lists (ports, airports…) come from the reference tables.
 */

// ── common (Step 1 + Review) ──────────────────────────────────────────────────
export const CLIENT_TYPES = ['individual', 'company', 'factory', 'trader', 'other'] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];
/** International + domestic forms (spec B3 Step 1). China adds trader / other (B5). */
export const SHIPPING_CLIENT_TYPES = ['individual', 'company', 'factory'] as const;
/** Client types that need the company / factory name (or, for "other", a description). */
export const NAMED_CLIENT_TYPES: readonly ClientType[] = ['company', 'factory', 'other'];

// ── international / domestic ──────────────────────────────────────────────────
export const OPERATION_TYPES = ['export', 'import', 'domestic'] as const;
export type OperationType = (typeof OPERATION_TYPES)[number];
export const SERVICE_SCOPES = ['shipping', 'customs', 'shipping_customs'] as const;
export type ServiceScope = (typeof SERVICE_SCOPES)[number];
export const SHIPPING_MODES = ['sea', 'air', 'land'] as const;
export type ShippingMode = (typeof SHIPPING_MODES)[number];
export const SEA_TYPES = ['fcl', 'lcl'] as const;
export const LAND_TYPES = ['container', 'general'] as const;
export const LOAD_TYPES = ['ftl', 'ltl'] as const;
export const AIR_SERVICES = [
  'airport_airport',
  'door_airport',
  'airport_door',
  'door_door',
] as const;
export type AirService = (typeof AIR_SERVICES)[number];
/** Clearance location and trucking side share the same three values. */
export const ROUTE_SIDES = ['origin', 'destination', 'both'] as const;
export const WEIGHT_UNITS = ['kg', 'ton'] as const;
export const CURRENCIES = ['USD', 'EUR', 'EGP'] as const;
export const INPUT_METHODS = ['manual', 'packing_list'] as const;
export const PACKAGING_TYPES = [
  'pallets',
  'wooden_crates',
  'cartons',
  'jumbo_bags',
  'drums',
  'bulk',
  'other',
] as const;
export const AVAILABLE_DOCUMENTS = [
  'import_export_card',
  'commercial_register',
  'tax_card',
] as const;
export const EXECUTION_DOCUMENTS = ['client', 'shipping_company'] as const;
export const INCOTERMS = ['EXW', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP'] as const;

// ── China / SHEIN ─────────────────────────────────────────────────────────────
export const CHINA_SOURCES = ['shein', 'chinese_sites'] as const;
export type ChinaSource = (typeof CHINA_SOURCES)[number];
export const SHEIN_SITES = ['shein_sa', 'shein_ae'] as const;
export const CHINESE_SITES = ['alibaba', 'taobao', '1688', 'other'] as const;
export const ADD_METHODS = ['cart_link', 'manual', 'screenshots'] as const;
/** Shipping methods per source (spec B5 Step 3); durations are in transit_estimates. */
export const CHINA_SHIPPING_METHODS: Record<ChinaSource, readonly ShippingMode[]> = {
  chinese_sites: ['air', 'sea'],
  shein: ['air', 'land'],
};

// ── attachments: where each uploaded file belongs (B8 "Attachments") ─────────
export const ATTACHMENT_SLOTS = [
  'cargo_packing_list', // packing list instead of manual products (LCL / air / LTL)
  'msds', // hazardous cargo (order level)
  'item_msds', // hazardous product (per item)
  'commercial_invoice',
  'packing_list',
  'draft_bl',
  'other_document',
  'screenshot', // China form
] as const;
export type AttachmentSlot = (typeof ATTACHMENT_SLOTS)[number];

/** Upload purpose expected for each slot (checked again in submit_order). */
export const SLOT_PURPOSE: Record<
  AttachmentSlot,
  'packing_list' | 'msds' | 'invoice' | 'document' | 'screenshot'
> = {
  cargo_packing_list: 'packing_list',
  msds: 'msds',
  item_msds: 'msds',
  commercial_invoice: 'invoice',
  packing_list: 'packing_list',
  draft_bl: 'document',
  other_document: 'document',
  screenshot: 'screenshot',
};

// ── limits ────────────────────────────────────────────────────────────────────
export const ORDER_LIMITS = {
  groups: 20,
  items: 50,
  chinaProducts: { min: 1, max: 10 },
  variants: 30,
  count: 999,
  cartons: 100_000,
  dimensionCm: 2000,
  weight: 1_000_000,
  money: 1_000_000_000,
  text: { min: 2, max: 100 },
  description: { min: 3, max: 500 },
  address: { min: 5, max: 300 },
  notesMax: 1000,
  urlMax: 2000,
} as const;

/** Bumped when a form changes shape (drafts and orders store it). */
export const ORDER_FORM_VERSIONS = {
  international: 'international@1',
  domestic: 'domestic@1',
  china: 'china@1',
} as const;

/** "MG1029": `MG` + a database sequence (plan §5 item 14). */
export const ORDER_REFERENCE_PATTERN = /^MG\d{4,}$/;

// ── API results ───────────────────────────────────────────────────────────────

/** POST /api/orders (201, or 200 for a replay of the same Idempotency-Key). */
export type SubmitOrderResult = {
  reference: string;
  balance: { remaining: number; total: number };
  /** true when this answer repeats an order already created with the same key. */
  replayed: boolean;
};

/** GET /api/orders/:reference: the stored order, rebuilt from its rows. */
export type OrderRecord = {
  reference: string;
  service: 'international' | 'domestic' | 'china';
  status: string;
  submittedAt: string;
  /** Same shape as the submitted (validated) order. */
  order: Record<string, unknown>;
  /** Computed on the server (spec B9). */
  derived: {
    items: Array<{ cbm: number; volumetricKg: number | null }>;
    totalContainers: number | null;
    totalTrucks: number | null;
    totalCbm: number | null;
  };
  attachments: Array<{
    id: string;
    slot: AttachmentSlot;
    name: string;
    mime: string;
    size: number;
  }>;
};
