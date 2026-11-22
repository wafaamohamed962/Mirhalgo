/**
 * Reference lists (MW_003 A2 + B1): served by GET /api/reference/:list from the reference
 * tables, cached. Names come in both languages; the web picks one by the current language.
 */

export type LocalizedName = { ar: string; en: string };

export type ReferenceCountry = {
  /** ISO 3166-1 alpha-2, e.g. "EG". */
  code: string;
  name: LocalizedName;
  /** Without "+", e.g. "20"; null when not known yet. */
  dialCode: string | null;
  /** A shipping company can register from this country. */
  companySignup: boolean;
  /** Delivery country of the "SHEIN & Chinese sites" form (spec B5). */
  chinaDelivery: boolean;
};

export type ReferenceRegion = {
  /** ISO 3166-2, e.g. "EG-C". */
  id: string;
  countryCode: string;
  name: LocalizedName;
};

/** City, e.g. "EG-CAIRO". */
export type ReferenceCity = { id: string; countryCode: string; name: LocalizedName };

/** Seaport, e.g. "EG-ALEXANDRIA"; `unlocode` only where verified. */
export type ReferencePort = {
  id: string;
  countryCode: string;
  unlocode: string | null;
  name: LocalizedName;
};

/** Airport; the id is the IATA code. */
export type ReferenceAirport = { id: string; countryCode: string; name: LocalizedName };

/** A plain option list (container types, truck types, shipping lines). */
export type ReferenceOption = { id: string; name: LocalizedName };

export const TRANSIT_SOURCES = ['china_sites', 'shein'] as const;
export type TransitSource = (typeof TRANSIT_SOURCES)[number];
export const TRANSIT_METHODS = ['air', 'sea', 'land'] as const;
export type TransitMethod = (typeof TRANSIT_METHODS)[number];

/** Delivery time shown per source × shipping method (spec B5, configurable in the DB). */
export type TransitEstimate = {
  source: TransitSource;
  method: TransitMethod;
  minDays: number;
  maxDays: number;
};

/** Lists available at /api/reference/:list, with the item type of each. */
export type ReferenceLists = {
  countries: ReferenceCountry;
  regions: ReferenceRegion;
  cities: ReferenceCity;
  ports: ReferencePort;
  airports: ReferenceAirport;
  'container-types': ReferenceOption;
  'truck-types': ReferenceOption;
  'shipping-lines': ReferenceOption;
  'transit-estimates': TransitEstimate;
};
export type ReferenceList = keyof ReferenceLists;

export const REFERENCE_LISTS = [
  'countries',
  'regions',
  'cities',
  'ports',
  'airports',
  'container-types',
  'truck-types',
  'shipping-lines',
  'transit-estimates',
] as const satisfies readonly ReferenceList[];

/** Lists that can be filtered with `?country=`. */
export const COUNTRY_FILTERED_LISTS = [
  'regions',
  'cities',
  'ports',
  'airports',
] as const satisfies readonly ReferenceList[];

/** `?scope=` of the countries list. */
export const COUNTRY_SCOPES = ['all', 'company_signup', 'china_delivery'] as const;
export type CountryScope = (typeof COUNTRY_SCOPES)[number];
