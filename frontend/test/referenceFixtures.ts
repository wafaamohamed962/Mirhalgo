import type {
  ReferenceAirport,
  ReferenceCountry,
  ReferenceOption,
  ReferencePort,
  ReferenceRegion,
  TransitEstimate,
} from '@mirhalgo/shared';

/** A small slice of the reference tables (MW_003 A2), shared by the unit and E2E tests. */

export const COUNTRIES: ReferenceCountry[] = [
  {
    code: 'EG',
    name: { ar: 'مصر', en: 'Egypt' },
    dialCode: '20',
    companySignup: true,
    chinaDelivery: true,
  },
  {
    code: 'SA',
    name: { ar: 'المملكة العربية السعودية', en: 'Saudi Arabia' },
    dialCode: '966',
    companySignup: true,
    chinaDelivery: true,
  },
  {
    code: 'AE',
    name: { ar: 'الإمارات العربية المتحدة', en: 'United Arab Emirates' },
    dialCode: '971',
    companySignup: true,
    chinaDelivery: true,
  },
  {
    code: 'CN',
    name: { ar: 'الصين', en: 'China' },
    dialCode: '86',
    companySignup: false,
    chinaDelivery: false,
  },
];

const region = (id: string, ar: string, en: string): ReferenceRegion => ({
  id,
  countryCode: id.slice(0, 2),
  name: { ar, en },
});

export const REGIONS: ReferenceRegion[] = [
  region('EG-C', 'القاهرة', 'Cairo'),
  region('EG-GZ', 'الجيزة', 'Giza'),
  region('EG-ALX', 'الإسكندرية', 'Alexandria'),
  region('SA-01', 'الرياض', 'Riyadh'),
  region('SA-02', 'مكة المكرمة', 'Makkah'),
  region('AE-DU', 'دبي', 'Dubai'),
  region('AE-AZ', 'أبوظبي', 'Abu Dhabi'),
];

// B1 lists
export const CITIES: ReferenceRegion[] = [
  region('EG-CAIRO', 'القاهرة', 'Cairo'),
  region('SA-JEDDAH', 'جدة', 'Jeddah'),
];
export const PORTS: ReferencePort[] = [
  { ...region('EG-ALEXANDRIA', 'الإسكندرية', 'Alexandria'), unlocode: 'EGALY' },
  { ...region('EG-DAMIETTA', 'دمياط', 'Damietta'), unlocode: 'EGDAM' },
  { ...region('CN-SHANGHAI', 'شنغهاي', 'Shanghai'), unlocode: 'CNSHA' },
];
export const AIRPORTS: ReferenceAirport[] = [
  { id: 'CAI', countryCode: 'EG', name: { ar: 'مطار القاهرة الدولي', en: 'Cairo International' } },
  {
    id: 'PVG',
    countryCode: 'CN',
    name: { ar: 'مطار شنغهاي بودونغ الدولي', en: 'Shanghai Pudong International' },
  },
];
const option = (id: string, ar: string, en: string): ReferenceOption => ({ id, name: { ar, en } });
export const CONTAINER_TYPES = [
  option('40_high_cube', 'حاوية ٤٠ قدمًا عالية (HC)', "40' High Cube"),
];
export const TRUCK_TYPES = [option('tanker', 'صهريج', 'Tanker')];
export const SHIPPING_LINES = [option('maersk', 'Maersk', 'Maersk')];
export const TRANSIT: TransitEstimate[] = [
  { source: 'china_sites', method: 'air', minDays: 15, maxDays: 25 },
  { source: 'shein', method: 'air', minDays: 10, maxDays: 15 },
];

const BY_COUNTRY: Record<string, Array<{ countryCode: string }>> = {
  regions: REGIONS,
  cities: CITIES,
  ports: PORTS,
  airports: AIRPORTS,
};
const PLAIN: Record<string, unknown[]> = {
  'container-types': CONTAINER_TYPES,
  'truck-types': TRUCK_TYPES,
  'shipping-lines': SHIPPING_LINES,
  'transit-estimates': TRANSIT,
};

/** The answer of GET /api/reference/<list>?<query>, or null for an unknown list. */
export function referenceResponse(list: string, query: URLSearchParams): unknown[] | null {
  if (list === 'countries') {
    const scope = query.get('scope');
    if (scope === 'company_signup') return COUNTRIES.filter((c) => c.companySignup);
    if (scope === 'china_delivery') return COUNTRIES.filter((c) => c.chinaDelivery);
    return COUNTRIES;
  }
  const byCountry = BY_COUNTRY[list];
  if (byCountry) {
    const country = query.get('country');
    return byCountry.filter((item) => !country || item.countryCode === country);
  }
  return PLAIN[list] ?? null;
}
