import { z } from 'zod';
import {
  CHINA_SERVICES,
  CHINA_SITES,
  COMPANY_ACTIVITIES,
  COMPANY_COUNTRIES,
  COMPANY_COUNTRY_RULES,
  COMPANY_LIMITS as L,
  INTERNATIONAL_MODES,
  INTERNATIONAL_SCOPES,
  SERVICE_ACTIVITIES,
  SERVICE_REGIONS,
  TERMS_VERSION,
  VEHICLE_TYPES,
  REGION_ID_PATTERN,
  isCompanyCountry,
  regionBelongsTo,
  type CompanyCountry,
  type LegalNumberRule,
} from '../company.js';
import { COUNTRIES } from '../phone.js';
import {
  digitsSchema,
  emailSchema,
  optional,
  optionalIntSchema,
  passwordSchema,
  phoneSchema,
  textSchema,
  toAsciiDigits,
  urlSchema,
} from './fields.js';

/*
 * Company registration (MW_002 A2). One flat-ish object shared by the 4-step wizard and
 * POST /api/companies/register (the `application` JSON part; files travel as multipart parts
 * and are checked with files.ts). Each step has its own schema so "Next" validates only the
 * current step; `companyRegistrationSchema` validates everything on submit and on the server.
 */

const required = () => ({ errorMap: () => ({ message: 'validation.required' }) });

/** Multi-select: at least one (unless `min: 0`), no duplicates, bounded size. */
const multiSelect = <T extends readonly [string, ...string[]]>(values: T, { min = 1 } = {}) =>
  z
    .array(z.enum(values, required()))
    .max(values.length)
    .refine((list) => new Set(list).size === list.length, 'validation.duplicate')
    .refine((list) => list.length >= min, 'validation.selectAtLeastOne');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const includes = (list: unknown, value: string) => Array.isArray(list) && list.includes(value);

/**
 * Drops data the user can no longer see, before validation: a `textKey` "Other" text when
 * "other" is not selected in `listKey`. Stale hidden values never block or get stored.
 */
const withoutStaleOther =
  (listKey: string, textKey: string) =>
  (raw: unknown): unknown => {
    if (!isRecord(raw) || includes(raw[listKey], 'other')) return raw;
    const { [textKey]: _stale, ...rest } = raw;
    return rest;
  };

/** Adds "required" on `textKey` when "other" is selected but no text was given. */
const requireOtherText = (
  data: Record<string, unknown>,
  listKey: string,
  textKey: string,
  ctx: z.RefinementCtx,
) => {
  if (includes(data[listKey], 'other') && !data[textKey]) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.required', path: [textKey] });
  }
};

const otherOptionText = optional(textSchema(L.otherOption, 'validation.otherOptionLength'));

// ── Step 1: account & company ─────────────────────────────────────────────

const accountShape = {
  legalName: textSchema(L.legalName, 'validation.companyNameLength'),
  representativeName: textSchema(L.representativeName, 'validation.representativeNameLength'),
  representativeTitle: textSchema(L.representativeTitle, 'validation.jobTitleLength'),
  email: emailSchema,
  phone: phoneSchema,
  whatsappSameAsMobile: z.boolean().default(false),
  whatsapp: optional(phoneSchema),
  landline: optional(digitsSchema(L.landlineDigits, 'validation.landline')),
  country: z.enum(COMPANY_COUNTRIES, required()),
  /** ISO 3166-2 id of the country's first-level division; the API checks it exists. */
  region: z.string(required()).trim().regex(REGION_ID_PATTERN, 'validation.required'),
  city: textSchema(L.city, 'validation.cityLength'),
  street: textSchema(L.street, 'validation.streetLength'),
  website: optional(urlSchema(L.websiteMax)),
  password: passwordSchema,
  confirmPassword: z.string(),
  activities: multiSelect(COMPANY_ACTIVITIES),
  otherActivity: optional(textSchema(L.otherActivity, 'validation.otherActivityLength')),
};

type AccountData = {
  password: string;
  confirmPassword: string;
  country: CompanyCountry;
  region: string;
} & Record<string, unknown>;

function refineAccount(data: AccountData, ctx: z.RefinementCtx) {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'validation.passwordMismatch',
      path: ['confirmPassword'],
    });
  }
  requireOtherText(data, 'activities', 'otherActivity', ctx);
  if (!regionBelongsTo(data.region, data.country)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.required', path: ['region'] });
  }
}

/** Step 1 values with the stale "Other activity" text and WhatsApp number removed. */
function normalizeAccount(raw: unknown): unknown {
  const data = withoutStaleOther('activities', 'otherActivity')(raw);
  if (!isRecord(data) || data.whatsappSameAsMobile !== true) return data;
  const { whatsapp: _sameAsMobile, ...rest } = data;
  return rest;
}

// ── Step 2: services (only the sections of the selected activities) ───────

const internationalSchema = z.object({
  modes: multiSelect(INTERNATIONAL_MODES),
  scope: z.enum(INTERNATIONAL_SCOPES, required()),
  countries: multiSelect(COUNTRIES.map((c) => c.iso) as [string, ...string[]], { min: 0 }).default(
    [],
  ),
  regions: multiSelect(SERVICE_REGIONS, { min: 0 }).default([]),
});

/** Region ids (ISO 3166-2) of the company's country; the API checks they exist. */
const regionIdsSchema = z
  .array(z.string().regex(REGION_ID_PATTERN, 'validation.required'))
  .max(100)
  .refine((list) => new Set(list).size === list.length, 'validation.duplicate');

const domesticObject = z.object({
  /** Covers every region of the company's own country (stored as the flag only). */
  allRegions: z.boolean().default(false),
  regions: regionIdsSchema.default([]),
  vehicleTypes: multiSelect(VEHICLE_TYPES),
  vehicleTypeOther: otherOptionText,
  fleetSize: optionalIntSchema(L.fleetSize, 'validation.fleetSize'),
});

const domesticSchema = z.preprocess(
  withoutStaleOther('vehicleTypes', 'vehicleTypeOther'),
  domesticObject
    .superRefine((data, ctx) => {
      if (!data.allRegions && data.regions.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'validation.selectAtLeastOne',
          path: ['regions'],
        });
      }
      requireOtherText(data, 'vehicleTypes', 'vehicleTypeOther', ctx);
    })
    // "All regions" is stored as the flag only (decision 15).
    .transform((data) => (data.allRegions ? { ...data, regions: [] } : data)),
);

const chinaObject = z.object({
  sites: multiSelect(CHINA_SITES),
  siteOther: otherOptionText,
  services: multiSelect(CHINA_SERVICES),
});

const chinaSchema = z.preprocess(
  withoutStaleOther('sites', 'siteOther'),
  chinaObject.superRefine((data, ctx) => requireOtherText(data, 'sites', 'siteOther', ctx)),
);

/** Keys are the activity ids (`SERVICE_ACTIVITIES`). */
const servicesShape = {
  international: internationalSchema.optional(),
  domestic: domesticSchema.optional(),
  china: chinaSchema.optional(),
  yearsInBusiness: optionalIntSchema(L.yearsInBusiness, 'validation.yearsInBusiness'),
};

/**
 * Removes what the user can no longer see: the sections of unticked activities, and, after a
 * country change, covered regions of another country and the own country among the countries
 * served (both are hidden from the lists, spec A2).
 */
function withoutUnselectedSections(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const data = { ...raw };
  for (const activity of SERVICE_ACTIVITIES) {
    if (!includes(data.activities, activity)) delete data[activity];
  }
  const country = data.country;
  if (typeof country !== 'string') return data;
  if (isRecord(data.domestic) && Array.isArray(data.domestic.regions)) {
    const regions = data.domestic.regions.filter(
      (id) => typeof id !== 'string' || regionBelongsTo(id, country),
    );
    data.domestic = { ...data.domestic, regions };
  }
  if (isRecord(data.international) && Array.isArray(data.international.countries)) {
    const countries = data.international.countries.filter((code) => code !== country);
    data.international = { ...data.international, countries };
  }
  return data;
}

function requireSelectedSections(data: Record<string, unknown>, ctx: z.RefinementCtx) {
  for (const activity of SERVICE_ACTIVITIES) {
    if (includes(data.activities, activity) && data[activity] === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.required',
        path: [activity],
      });
    }
  }
}

// ── Step 3: legal (the files are validated separately, see files.ts) ──────
// The rules depend on the company country (MW_003 A2): see COMPANY_COUNTRY_RULES.

export const LEGAL_FIELDS = {
  commercialRegisterNumber: 'registration',
  taxNumber: 'tax',
} as const;
type LegalField = keyof typeof LEGAL_FIELDS;

/** As stored: digits only, or uppercase letters/digits/hyphens (UAE trade license). */
export function normalizeLegalNumber(rule: LegalNumberRule, raw: string): string {
  const value = toAsciiDigits(raw).replace(/\s/g, '');
  return rule.kind === 'digits' ? value.replace(/-/g, '') : value.toUpperCase();
}

const legalPattern = ({ kind, min, max }: LegalNumberRule) =>
  kind === 'digits'
    ? new RegExp(`^[0-9]{${min},${max}}$`)
    : new RegExp(`^[A-Z0-9][A-Z0-9-]{${min - 2},${max - 2}}[A-Z0-9]$`); // no hyphen at either end

/** The rule of a legal field for a country, or null for a country without rules. */
export const legalRule = (country: unknown, field: LegalField): LegalNumberRule | null =>
  isCompanyCountry(country) ? COMPANY_COUNTRY_RULES[country][LEGAL_FIELDS[field]] : null;

/**
 * Input mask while typing (Step 3): Egyptian tax card "XXX-XXX-XXX", other digit fields
 * digits only, the UAE trade license uppercase. Always capped at the maximum length.
 */
export function formatLegalNumber(country: unknown, field: LegalField, value: string): string {
  const rule = legalRule(country, field);
  const ascii = toAsciiDigits(value);
  if (!rule) return ascii;
  if (rule.kind === 'alphanumeric') {
    return ascii
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, rule.max);
  }
  const digits = ascii.replace(/\D/g, '').slice(0, rule.max);
  return country === 'EG' && field === 'taxNumber'
    ? digits.replace(/(\d{3})(?=\d)/g, '$1-')
    : digits;
}

const legalShape = {
  commercialRegisterNumber: z.string(required()),
  taxNumber: z.string(required()),
};

type LegalData = { country: unknown } & Record<LegalField, string>;

/** Per-country format; the message names the country's document, e.g. "validation.legal.SA.tax". */
function refineLegal(data: LegalData, ctx: z.RefinementCtx) {
  for (const field of Object.keys(LEGAL_FIELDS) as LegalField[]) {
    const rule = legalRule(data.country, field);
    if (!rule) continue; // the country itself is reported as invalid
    const value = normalizeLegalNumber(rule, data[field]);
    const message = !value
      ? 'validation.required'
      : legalPattern(rule).test(value)
        ? null
        : `validation.legal.${String(data.country)}.${LEGAL_FIELDS[field]}`;
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [field] });
  }
}

/** Stored form of both legal numbers (call after refineLegal passed). */
function normalizeLegal<T extends LegalData>(data: T): T {
  const normalized = { ...data };
  for (const field of Object.keys(LEGAL_FIELDS) as LegalField[]) {
    const rule = legalRule(data.country, field);
    if (rule) normalized[field] = normalizeLegalNumber(rule, data[field]);
  }
  return normalized;
}

// ── Step 4: review ────────────────────────────────────────────────────────

const reviewShape = {
  notes: optional(
    textSchema({ min: 1, max: L.notesMax }, 'validation.notesLength', { multiline: true }),
  ),
  confirmAccuracy: z.literal(true, { errorMap: () => ({ message: 'validation.declaration' }) }),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'validation.terms' }) }),
  /** The version shown to the user; a stale client is rejected (decision 11). */
  termsVersion: z.literal(TERMS_VERSION, {
    errorMap: () => ({ message: 'validation.termsVersion' }),
  }),
};

// ── Step schemas (wizard "Next") ──────────────────────────────────────────

export const companyAccountStepSchema = z.preprocess(
  normalizeAccount,
  z.object(accountShape).superRefine(refineAccount),
);

/** Step 2 needs the activities chosen in Step 1 to know which sections are required. */
export const companyServicesStepSchema = z.preprocess(
  withoutUnselectedSections,
  z
    .object({
      activities: accountShape.activities,
      country: accountShape.country,
      ...servicesShape,
    })
    .superRefine(requireSelectedSections),
);

/** Step 3 needs the country chosen in Step 1 to know the rules. */
export const companyLegalStepSchema = z
  .object({ country: accountShape.country, ...legalShape })
  .superRefine(refineLegal)
  .transform(normalizeLegal);
export const companyReviewStepSchema = z.object(reviewShape);

// ── Full application (submit + server) ────────────────────────────────────

const registrationObject = z.object({
  ...accountShape,
  ...servicesShape,
  ...legalShape,
  ...reviewShape,
});

export const companyRegistrationSchema = z.preprocess(
  (raw) => withoutUnselectedSections(normalizeAccount(raw)),
  registrationObject
    .superRefine((data, ctx) => {
      refineAccount(data, ctx);
      requireSelectedSections(data, ctx);
      refineLegal(data, ctx);
    })
    .transform((data) => ({
      ...normalizeLegal(data),
      whatsapp: data.whatsappSameAsMobile ? data.phone : data.whatsapp,
    })),
);

/** A whole number typed in a form input ("" = empty) or sent as JSON. */
type FormInteger = string | number;

/**
 * Values held by the wizard form (before parsing). Written out for the fields wrapped in
 * z.preprocess, whose Zod input type is `unknown`.
 */
export type CompanyRegistrationFormValues = Omit<
  z.input<typeof registrationObject>,
  'domestic' | 'china' | 'yearsInBusiness'
> & {
  domestic?: Omit<z.input<typeof domesticObject>, 'fleetSize'> & { fleetSize?: FormInteger };
  china?: z.input<typeof chinaObject>;
  yearsInBusiness?: FormInteger;
};
/** Parsed, normalised application (what the server stores). */
export type CompanyRegistration = z.output<typeof companyRegistrationSchema>;
