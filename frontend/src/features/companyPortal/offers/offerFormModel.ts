import { TOTAL_KIND, type CompanyOffer, type OfferTemplate } from '@mirhalgo/shared';

/*
 * The offer form per template (MW_004 spec B5). Every template field is optional; the total
 * is required (dual currency or EGP only, TOTAL_KIND). Validation = the shared offerSchemas.
 */

export type OfferFieldKind = 'cost' | 'days' | 'date' | 'text' | 'longText' | 'vehicle';
export type OfferField = { name: string; kind: OfferFieldKind };

const f = (name: string, kind: OfferFieldKind): OfferField => ({ name, kind });

export const OFFER_FIELDS: Record<OfferTemplate, readonly OfferField[]> = {
  sea: [
    f('oceanFreight', 'cost'),
    f('thc', 'cost'),
    f('blFee', 'cost'),
    f('telexRelease', 'cost'),
    f('transitDays', 'days'),
    f('freeDays', 'days'),
    f('departureDate', 'date'),
  ],
  international_land: [
    f('vehicleType', 'vehicle'),
    f('transportCost', 'cost'),
    f('transitDays', 'days'),
    f('loadingDate', 'date'),
    f('borderCrossing', 'text'),
    f('notes', 'longText'),
  ],
  domestic_land: [
    f('vehicleType', 'vehicle'),
    f('transportCost', 'cost'),
    f('transitDays', 'days'),
    f('loadingDate', 'date'),
    f('notes', 'longText'),
  ],
  air: [
    f('airFreightCost', 'cost'),
    f('airline', 'text'),
    f('flightDate', 'date'),
    f('transitDays', 'days'),
    f('extraCharges', 'longText'),
  ],
  china: [f('weightCost', 'cost'), f('productPurchaseCost', 'cost'), f('shippingDays', 'days')],
};

/** Cost lines start in the usual currency of the template (plan Q6); the user can change it. */
export const DEFAULT_COST_CURRENCY: Record<OfferTemplate, 'USD' | 'EGP'> = {
  sea: 'USD',
  international_land: 'USD',
  domestic_land: 'EGP',
  air: 'USD',
  china: 'EGP',
};

type CostValue = { amount: string; currency: string };
export type OfferFormValues = {
  template: OfferTemplate;
  details: Record<string, string | CostValue>;
  total: { foreign?: CostValue; egp: string };
};

const text = (value: unknown) => (value === undefined || value === null ? '' : String(value));

/** Form values (strings, as inputs hold them): empty for a new offer, the offer's for an edit. */
export function toFormValues(template: OfferTemplate, offer?: CompanyOffer): OfferFormValues {
  const saved = (offer?.details ?? {}) as Record<string, unknown>;
  const details: OfferFormValues['details'] = {};
  for (const field of OFFER_FIELDS[template]) {
    const value = saved[field.name];
    if (field.kind === 'cost') {
      const line = value as { amount: number; currency: string } | undefined;
      details[field.name] = {
        amount: text(line?.amount),
        currency: line?.currency ?? DEFAULT_COST_CURRENCY[template],
      };
    } else {
      details[field.name] = text(value);
    }
  }
  const total = offer?.total;
  return {
    template,
    details,
    total:
      TOTAL_KIND[template] === 'dual'
        ? {
            foreign: {
              amount: text(total?.foreign?.amount),
              currency: total?.foreign?.currency ?? 'USD',
            },
            egp: text(total?.egp),
          }
        : { egp: text(total?.egp) },
  };
}
