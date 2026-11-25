import { z } from 'zod';
import { FOREIGN_CURRENCIES, type ForeignCurrency } from '../companyPortal.js';
import { CURRENCIES } from '../orders.js';
import { emailSchema, optional, optionalIntSchema, phoneSchema, textSchema } from './fields.js';
import { notPastDate, numberInput } from './orders.js';

/*
 * Company portal forms (MW_004 B1, spec B5 + B8 + B9). Used by the web forms and the mock
 * handlers now, and by the real API later. The password form reuses `changePasswordSchema`
 * (current + new + confirm, the sign-up policy).
 */

const required = () => ({ errorMap: () => ({ message: 'validation.required' }) });

export const COMPANY_PORTAL_LIMITS = {
  money: 1_000_000_000,
  days: { min: 1, max: 365 },
  shortText: { min: 1, max: 100 },
  longText: { min: 1, max: 500 },
  reply: { min: 10, max: 2000 },
} as const;
const L = COMPANY_PORTAL_LIMITS;

// ── fields ───────────────────────────────────────────────────────────────────────────

/** A positive amount: Arabic / Persian digits and "٫" accepted, 2 decimals kept. */
const amountNumber = z
  .number({
    required_error: 'validation.required',
    invalid_type_error: 'validation.positiveNumber',
  })
  .finite('validation.positiveNumber')
  .gt(0, 'validation.positiveNumber')
  .max(L.money, 'validation.positiveNumber')
  .transform((n) => Number(n.toFixed(2)));
const amount = z.preprocess(numberInput, amountNumber);
const optionalAmount = z.preprocess(numberInput, amountNumber.optional());

/** A form sends `{ amount: '', currency }` for an untouched line: that means "no value". */
const withoutEmptyAmount = (value: unknown) =>
  value && typeof value === 'object' && 'amount' in value && numberInput(value.amount) === undefined
    ? undefined
    : value;

/** An optional cost line (ocean freight, THC…) in any currency. Not summed into the total. */
const costLine = z.preprocess(
  withoutEmptyAmount,
  z
    .object({ amount, currency: z.enum(CURRENCIES, required()) })
    .strict()
    .optional(),
);
const days = optionalIntSchema(L.days, 'validation.daysRange');
const date = optional(notPastDate);
const shortText = optional(textSchema(L.shortText, 'validation.offerTextLength'));
const longText = optional(
  textSchema(L.longText, 'validation.offerLongTextLength', { multiline: true }),
);
/** A `truck_types` reference id (the existing list, MW_003 B1). */
const vehicleType = optional(z.string().regex(/^[A-Za-z0-9_.-]{1,60}$/, 'validation.required'));

// ── total cost (spec B5) ────────────────────────────────────────────────────────────────

/** Foreign (USD / EUR) and/or EGP: at least one, both allowed. */
const dualTotal = z
  .object({
    foreign: z.preprocess(
      withoutEmptyAmount,
      z
        .object({ amount, currency: z.enum(FOREIGN_CURRENCIES, required()) })
        .strict()
        .optional(),
    ),
    egp: optionalAmount,
  })
  .strict()
  .refine((total) => total.foreign !== undefined || total.egp !== undefined, {
    message: 'validation.offerTotalRequired',
    path: ['egp'],
  });
const egpTotal = z.object({ egp: amount }).strict();

export type OfferTotal = { foreign?: { amount: number; currency: ForeignCurrency }; egp?: number };

// ── the five templates (every field optional, the total required) ──────────────────────────

const seaDetails = z
  .object({
    oceanFreight: costLine,
    thc: costLine,
    blFee: costLine,
    telexRelease: costLine,
    transitDays: days,
    freeDays: days,
    departureDate: date,
  })
  .strict();
const internationalLandDetails = z
  .object({
    vehicleType,
    transportCost: costLine,
    transitDays: days,
    loadingDate: date,
    borderCrossing: shortText,
    notes: longText,
  })
  .strict();
const domesticLandDetails = z
  .object({
    vehicleType,
    transportCost: costLine,
    transitDays: days,
    loadingDate: date,
    notes: longText,
  })
  .strict();
const airDetails = z
  .object({
    airFreightCost: costLine,
    airline: shortText,
    flightDate: date,
    transitDays: days,
    extraCharges: longText,
  })
  .strict();
const chinaDetails = z
  .object({ weightCost: costLine, productPurchaseCost: costLine, shippingDays: days })
  .strict();

const offerOf = <T extends string, D extends z.ZodTypeAny, M extends z.ZodTypeAny>(
  template: T,
  details: D,
  total: M,
) => z.object({ template: z.literal(template), details, total }).strict();

/** One schema per template, for the form resolver (spec B5: the form follows the category). */
export const offerSchemas = {
  sea: offerOf('sea', seaDetails, dualTotal),
  international_land: offerOf('international_land', internationalLandDetails, dualTotal),
  domestic_land: offerOf('domestic_land', domesticLandDetails, egpTotal),
  air: offerOf('air', airDetails, dualTotal),
  china: offerOf('china', chinaDetails, egpTotal),
};

/**
 * POST /company/requests/:id/offers and PATCH /company/offers/:id. The server also checks that
 * the template is the order's (TEMPLATE_OF[category]).
 */
export const offerInputSchema = z.discriminatedUnion('template', [
  offerSchemas.sea,
  offerSchemas.international_land,
  offerSchemas.domestic_land,
  offerSchemas.air,
  offerSchemas.china,
]);
export type OfferInput = z.input<typeof offerInputSchema>;
export type OfferValues = z.output<typeof offerInputSchema>;
export type OfferDetails = OfferValues['details'];

// ── inquiries and settings (spec B8, B9) ────────────────────────────────────────────────

export const inquiryReplySchema = z.object({
  reply: textSchema(L.reply, 'validation.replyLength', { multiline: true }),
});
export type InquiryReplyInput = z.infer<typeof inquiryReplySchema>;

export const companyContactSchema = z.object({
  contactEmail: emailSchema,
  contactPhone: phoneSchema,
});
export type CompanyContactInput = z.infer<typeof companyContactSchema>;

export const offerPrivacySchema = z.object({ hideOffers: z.boolean() });
export type OfferPrivacyInput = z.infer<typeof offerPrivacySchema>;
