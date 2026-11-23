/**
 * Company registration constants (MW_002 A2–A4). These ids are stored as Postgres enums
 * (structured, queryable: orders are matched to companies by service, mode and governorate
 * later), so never rename an id without a migration. Labels live in the web i18n files.
 */

export const USER_ROLES = ['customer', 'company', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Version of the Terms of Service / Privacy Policy accepted at registration (decision 11). */
export const TERMS_VERSION = '2026-11-21';

/**
 * The 27 Egyptian governorates (MW_002 slugs). Since MW_003 A2 the company wizard uses the
 * `regions` reference table (ISO 3166-2 ids) instead; only the still-mocked portal parts
 * (saved addresses, company directory) use these until they are connected.
 */
export const GOVERNORATES = [
  'cairo',
  'giza',
  'alexandria',
  'qalyubia',
  'sharqia',
  'dakahlia',
  'gharbia',
  'monufia',
  'beheira',
  'kafr_el_sheikh',
  'damietta',
  'port_said',
  'ismailia',
  'suez',
  'north_sinai',
  'south_sinai',
  'red_sea',
  'faiyum',
  'beni_suef',
  'minya',
  'asyut',
  'sohag',
  'qena',
  'luxor',
  'aswan',
  'new_valley',
  'matrouh',
] as const;
export type Governorate = (typeof GOVERNORATES)[number];

// ── Company country (MW_003 A2) ───────────────────────────────────────────

/**
 * Countries a company can register from. The `countries.company_signup` flag in the DB lists
 * the same codes (the wizard shows the intersection), and each one needs its rules below AND
 * in the `companies_legal_numbers_check` constraint. Adding a country = DB row + rules here.
 */
export const COMPANY_COUNTRIES = ['EG', 'SA', 'AE'] as const;
export type CompanyCountry = (typeof COMPANY_COUNTRIES)[number];

export const isCompanyCountry = (code: unknown): code is CompanyCountry =>
  (COMPANY_COUNTRIES as readonly unknown[]).includes(code);

/** A legal number: digits only, or (UAE trade license) uppercase letters/digits/hyphens. */
export type LegalNumberRule =
  { kind: 'digits'; min: number; max: number } | { kind: 'alphanumeric'; min: number; max: number };

export type CompanyCountryRules = {
  /** Label of the first-level division: Governorate (EG), Region (SA), Emirate (AE). */
  regionLabel: 'governorate' | 'region' | 'emirate';
  /** EG commercial register · SA Commercial Registration (CR) · AE trade license. */
  registration: LegalNumberRule;
  /** EG tax card · SA VAT number · AE TRN. */
  tax: LegalNumberRule;
};

/** Spec A2 table + plan decision (UAE trade license 3–20 characters). */
export const COMPANY_COUNTRY_RULES: Record<CompanyCountry, CompanyCountryRules> = {
  EG: {
    regionLabel: 'governorate',
    registration: { kind: 'digits', min: 1, max: 10 }, // decision 14
    tax: { kind: 'digits', min: 9, max: 9 },
  },
  SA: {
    regionLabel: 'region',
    registration: { kind: 'digits', min: 10, max: 10 },
    tax: { kind: 'digits', min: 15, max: 15 },
  },
  AE: {
    regionLabel: 'emirate',
    registration: { kind: 'alphanumeric', min: 3, max: 20 },
    tax: { kind: 'digits', min: 15, max: 15 },
  },
};

/** ISO 3166-2 region id, e.g. "EG-C", "SA-01", "AE-DU". */
export const REGION_ID_PATTERN = /^[A-Z]{2}-[A-Z0-9]{1,3}$/;
export const regionBelongsTo = (regionId: string, country: string) =>
  regionId.startsWith(`${country}-`);

/** Activities with their own Step 2 section. Each id is also the key of that section. */
export const SERVICE_ACTIVITIES = ['international', 'domestic', 'china'] as const;
export type ServiceActivity = (typeof SERVICE_ACTIVITIES)[number];

export const COMPANY_ACTIVITIES = [...SERVICE_ACTIVITIES, 'other'] as const;
export type CompanyActivity = (typeof COMPANY_ACTIVITIES)[number];

/** Step 2 is skipped when no selected activity has a services section ("Other" only). */
export const needsServicesStep = (activities: readonly CompanyActivity[]) =>
  activities.some((activity) => activity !== 'other');

export const INTERNATIONAL_MODES = ['air', 'sea', 'land'] as const;
export type InternationalMode = (typeof INTERNATIONAL_MODES)[number];

/** "Shipping only · Customs clearance only · Both". */
export const INTERNATIONAL_SCOPES = ['shipping', 'customs', 'both'] as const;
export type InternationalScope = (typeof INTERNATIONAL_SCOPES)[number];

/** Served regions (decision 16); countries come from `COUNTRIES` in phone.ts. */
export const SERVICE_REGIONS = [
  'gulf',
  'middle_east',
  'europe',
  'china',
  'east_asia',
  'north_america',
  'africa',
] as const;
export type ServiceRegion = (typeof SERVICE_REGIONS)[number];

export const VEHICLE_TYPES = ['pickup', 'box_truck', 'trailer', 'refrigerated', 'other'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const CHINA_SITES = ['shein', 'alibaba', '1688', 'taobao', 'other'] as const;
export type ChinaSite = (typeof CHINA_SITES)[number];

export const CHINA_SERVICES = ['purchasing', 'consolidation', 'shipping_to_egypt'] as const;
export type ChinaService = (typeof CHINA_SERVICES)[number];

/**
 * Application lifecycle (spec A3). The reference number (`MG-C-YYYY-000123`, decision 9)
 * is generated by the database at registration.
 */
export const APPLICATION_STATUSES = [
  'pending_verification',
  'pending_review',
  'approved',
  'rejected',
  'changes_requested',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Who changed an application status (history log). */
export const STATUS_ACTOR_TYPES = ['system', 'company', 'admin'] as const;
export type StatusActorType = (typeof STATUS_ACTOR_TYPES)[number];

/** Field ranges (spec A2 + decision 14). Shared by the schemas and the form hints. */
export const COMPANY_LIMITS = {
  legalName: { min: 2, max: 120 },
  representativeName: { min: 3, max: 80 },
  representativeTitle: { min: 2, max: 60 },
  city: { min: 2, max: 60 },
  street: { min: 5, max: 200 },
  otherActivity: { min: 3, max: 150 },
  otherOption: { min: 3, max: 100 },
  landlineDigits: { min: 7, max: 12 },
  websiteMax: 300,
  yearsInBusiness: { min: 0, max: 100 },
  fleetSize: { min: 0, max: 10_000 },
  notesMax: 1000,
} as const;
