import { z } from 'zod';
import {
  CHINA_SERVICES,
  CHINA_SITES,
  COMPANY_ACTIVITIES,
  COMPANY_LIMITS as L,
  GOVERNORATES,
  INTERNATIONAL_MODES,
  INTERNATIONAL_SCOPES,
  SERVICE_ACTIVITIES,
  SERVICE_REGIONS,
  TERMS_VERSION,
  VEHICLE_TYPES,
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
  governorate: z.enum(GOVERNORATES, required()),
  city: textSchema(L.city, 'validation.cityLength'),
  street: textSchema(L.street, 'validation.streetLength'),
  website: optional(urlSchema(L.websiteMax)),
  password: passwordSchema,
  confirmPassword: z.string(),
  activities: multiSelect(COMPANY_ACTIVITIES),
  otherActivity: optional(textSchema(L.otherActivity, 'validation.otherActivityLength')),
};

type AccountData = { password: string; confirmPassword: string } & Record<string, unknown>;

function refineAccount(data: AccountData, ctx: z.RefinementCtx) {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'validation.passwordMismatch',
      path: ['confirmPassword'],
    });
  }
  requireOtherText(data, 'activities', 'otherActivity', ctx);
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

const domesticObject = z.object({
  allGovernorates: z.boolean().default(false),
  governorates: multiSelect(GOVERNORATES, { min: 0 }).default([]),
  vehicleTypes: multiSelect(VEHICLE_TYPES),
  vehicleTypeOther: otherOptionText,
  fleetSize: optionalIntSchema(L.fleetSize, 'validation.fleetSize'),
});

const domesticSchema = z.preprocess(
  withoutStaleOther('vehicleTypes', 'vehicleTypeOther'),
  domesticObject
    .superRefine((data, ctx) => {
      if (!data.allGovernorates && data.governorates.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'validation.selectAtLeastOne',
          path: ['governorates'],
        });
      }
      requireOtherText(data, 'vehicleTypes', 'vehicleTypeOther', ctx);
    })
    // "All governorates" is stored as the flag only (decision 15).
    .transform((data) => (data.allGovernorates ? { ...data, governorates: [] } : data)),
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

/** Removes the sections of activities that are not selected (the user unticked them). */
function withoutUnselectedSections(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const data = { ...raw };
  for (const activity of SERVICE_ACTIVITIES) {
    if (!includes(data.activities, activity)) delete data[activity];
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

const legalShape = {
  commercialRegisterNumber: digitsSchema(
    L.commercialRegisterDigits,
    'validation.commercialRegister',
  ),
  taxNumber: digitsSchema(
    { min: L.taxNumberDigits, max: L.taxNumberDigits },
    'validation.taxNumber',
  ),
};

/** 9 digits → "XXX-XXX-XXX" (input mask). Accepts partial input while typing. */
export const formatTaxNumber = (value: string) =>
  value
    .replace(/\D/g, '')
    .slice(0, L.taxNumberDigits)
    .replace(/(\d{3})(?=\d)/g, '$1-');

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
    .object({ activities: accountShape.activities, ...servicesShape })
    .superRefine(requireSelectedSections),
);

export const companyLegalStepSchema = z.object(legalShape);
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
    })
    .transform((data) => ({
      ...data,
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
