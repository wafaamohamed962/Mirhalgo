import { describe, expect, it } from 'vitest';
import {
  OFFER_TEMPLATES,
  SERVICE_CATEGORIES,
  TEMPLATE_OF,
  TOTAL_KIND,
  categoryOf,
  companyContactSchema,
  inquiryReplySchema,
  offerInputSchema,
  offerSchemas,
  orderSchema,
  toCompanyOrder,
  type Order,
} from '../src/index.js';
import { air, chinaManual, domesticGeneral, landFtl, seaFcl, tomorrow } from './orderFixtures.js';

/* Company portal contract (MW_004 B1): categories, privacy, offer templates, total cost rules. */

const order = (input: unknown): Order => orderSchema.parse(input);
const shein = {
  ...chinaManual,
  order: {
    source: 'shein',
    sheinSite: 'shein_sa',
    addMethod: 'cart_link',
    cartUrl: 'https://shein.com/cart/1',
  },
  delivery: { ...chinaManual.delivery, shippingMethod: 'air' },
};

/** Messages by path, for readable assertions. */
function issues(
  schema: {
    safeParse: (v: unknown) => {
      error?: { issues: Array<{ path: (string | number)[]; message: string }> };
    };
  },
  value: unknown,
) {
  const map: Record<string, string[]> = {};
  for (const i of schema.safeParse(value).error?.issues ?? [])
    (map[i.path.join('.')] ??= []).push(i.message);
  return map;
}

describe('categories and templates', () => {
  it.each([
    ['sea FCL', seaFcl, 'sea', 'sea'],
    ['air', air, 'air', 'air'],
    ['land FTL', landFtl, 'international_land', 'international_land'],
    ['domestic', domesticGeneral, 'domestic_land', 'domestic_land'],
    ['Chinese sites', chinaManual, 'chinese_sites', 'china'],
  ] as const)('%s → category %s, template %s', (_, input, category, template) => {
    expect(categoryOf(order(input))).toBe(category);
    expect(TEMPLATE_OF[category]).toBe(template);
  });

  it('SHEIN has its own category but the China template', () => {
    const parsed = orderSchema.safeParse(shein);
    // the cart-link fixture may not satisfy every China rule; the category only needs the source
    const value = (parsed.success ? parsed.data : { ...shein, service: 'china' }) as Order;
    expect(categoryOf(value)).toBe('shein');
    expect(TEMPLATE_OF.shein).toBe('china');
  });

  it('every category has a template; dual currency for sea / land / air, EGP only otherwise', () => {
    for (const category of SERVICE_CATEGORIES)
      expect(OFFER_TEMPLATES).toContain(TEMPLATE_OF[category]);
    expect(TOTAL_KIND).toEqual({
      sea: 'dual',
      international_land: 'dual',
      domestic_land: 'egp',
      air: 'dual',
      china: 'egp',
    });
  });
});

describe('toCompanyOrder (privacy, spec B1)', () => {
  const CONTACT_VALUES = ['Wafaa Mohamed', '+201012345678', 'Nile Imports'];

  it.each([
    ['international', seaFcl],
    ['domestic', domesticGeneral],
    ['china (receiver too)', chinaManual],
  ])(
    '%s: no name, phone, WhatsApp or business name anywhere; the client type stays',
    (_, input) => {
      const visible = toCompanyOrder(order(input));
      const json = JSON.stringify(visible);
      for (const value of CONTACT_VALUES) expect(json).not.toContain(value);
      expect(visible).not.toHaveProperty('contact');
      expect(visible.clientType).toBe(order(input).contact.clientType);
    },
  );

  it('keeps everything a company needs to quote', () => {
    const visible = toCompanyOrder(order(chinaManual));
    if (visible.service !== 'china') throw new Error('expected china');
    expect(visible.delivery).toEqual({
      shippingMethod: 'sea',
      country: { id: 'EG' },
      city: { id: 'EG-CAIRO' },
      address: 'Building 4, Street 9, Maadi',
    });
    expect(visible.order.products).toHaveLength(2);
    expect(categoryOf(visible)).toBe('chinese_sites');
  });
});

describe('offer schemas (spec B5)', () => {
  it('every template field is optional: the total alone is enough', () => {
    expect(
      offerInputSchema.parse({ template: 'sea', details: {}, total: { egp: '5200' } }),
    ).toEqual({
      template: 'sea',
      details: {},
      total: { egp: 5200 },
    });
    expect(
      offerSchemas.china.parse({ template: 'china', details: {}, total: { egp: 900 } }).total,
    ).toEqual({
      egp: 900,
    });
  });

  it('dual currency: foreign and/or EGP, at least one; untouched lines from the form are dropped', () => {
    const dual = (total: unknown) => ({ template: 'air', details: {}, total });
    expect(
      offerInputSchema.parse(dual({ foreign: { amount: '1000', currency: 'USD' }, egp: '38000' }))
        .total,
    ).toEqual({
      foreign: { amount: 1000, currency: 'USD' },
      egp: 38000,
    });
    expect(
      offerInputSchema.parse(dual({ foreign: { amount: '', currency: 'EUR' }, egp: '500' })).total,
    ).toEqual({ egp: 500 });
    expect(
      issues(offerInputSchema, dual({ foreign: { amount: '', currency: 'USD' }, egp: '' })),
    ).toEqual({
      'total.egp': ['validation.offerTotalRequired'],
    });
    // EGP is not a "foreign" currency
    expect(
      issues(offerInputSchema, dual({ foreign: { amount: 5, currency: 'EGP' } })),
    ).toHaveProperty('total.foreign.currency');
  });

  it('EGP only (domestic, China): one amount, required; no foreign amount accepted', () => {
    expect(issues(offerInputSchema, { template: 'domestic_land', details: {}, total: {} })).toEqual(
      {
        'total.egp': ['validation.required'],
      },
    );
    expect(
      issues(offerInputSchema, {
        template: 'china',
        details: {},
        total: { egp: 10, foreign: { amount: 1, currency: 'USD' } },
      }),
    ).toHaveProperty('total');
  });

  it('amounts: positive only, Arabic digits and "٫" converted, 2 decimals kept', () => {
    const egp = (value: unknown) =>
      offerSchemas.domestic_land.safeParse({
        template: 'domestic_land',
        details: {},
        total: { egp: value },
      });
    expect(egp('٥٢٠٠').data?.total.egp).toBe(5200);
    expect(egp('١٢٫٥').data?.total.egp).toBe(12.5);
    expect(egp('10.456').data?.total.egp).toBe(10.46);
    for (const bad of ['0', '-5', 'abc', 'Infinity']) expect(egp(bad).success).toBe(false);
  });

  it('a full sea offer: cost lines in any currency, days, a date from today', () => {
    const value = offerInputSchema.parse({
      template: 'sea',
      details: {
        oceanFreight: { amount: '٨٠٠', currency: 'USD' },
        thc: { amount: '', currency: 'USD' }, // untouched → dropped
        blFee: { amount: '1500', currency: 'EGP' },
        transitDays: '٢٥',
        freeDays: '',
        departureDate: tomorrow(),
      },
      total: { foreign: { amount: 900, currency: 'USD' } },
    });
    expect(value.details).toEqual({
      oceanFreight: { amount: 800, currency: 'USD' },
      blFee: { amount: 1500, currency: 'EGP' },
      transitDays: 25,
      departureDate: tomorrow(),
    });
  });

  it('field rules: days 1–365, no past date, text lengths, unknown fields rejected', () => {
    const land = (details: Record<string, unknown>) => ({
      template: 'international_land',
      details,
      total: { egp: 1 },
    });
    expect(issues(offerInputSchema, land({ transitDays: '0' }))).toEqual({
      'details.transitDays': ['validation.daysRange'],
    });
    expect(issues(offerInputSchema, land({ loadingDate: '2020-01-01' }))).toEqual({
      'details.loadingDate': ['validation.readyDate'],
    });
    expect(issues(offerInputSchema, land({ borderCrossing: 'x'.repeat(101) }))).toEqual({
      'details.borderCrossing': ['validation.offerTextLength'],
    });
    expect(issues(offerInputSchema, land({ notes: 'x'.repeat(501) }))).toEqual({
      'details.notes': ['validation.offerLongTextLength'],
    });
    // a field of another template (strict objects)
    expect(
      issues(offerInputSchema, land({ oceanFreight: { amount: 1, currency: 'USD' } })),
    ).toHaveProperty('details');
    expect(
      offerInputSchema.safeParse({ template: 'rail', details: {}, total: { egp: 1 } }).success,
    ).toBe(false);
  });
});

describe('inquiry reply and contact settings (spec B8, B9)', () => {
  it('reply: required, 10–2000 characters, line breaks allowed', () => {
    // like every text field: "required" first (the one the form shows), then the length rule
    expect(issues(inquiryReplySchema, { reply: '' }).reply?.[0]).toBe('validation.required');
    expect(issues(inquiryReplySchema, { reply: 'Too short' })).toEqual({
      reply: ['validation.replyLength'],
    });
    expect(
      inquiryReplySchema.parse({ reply: 'Yes, door to door.\nTransit 25 days.' }).reply,
    ).toContain('\n');
  });

  it('contact: a valid email and an E.164 phone with its country code', () => {
    expect(
      companyContactSchema.safeParse({
        contactEmail: 'ops@alex.example',
        contactPhone: '+201000000002',
      }).success,
    ).toBe(true);
    expect(
      Object.keys(issues(companyContactSchema, { contactEmail: 'nope', contactPhone: '0100' })),
    ).toEqual(['contactEmail', 'contactPhone']);
  });
});
