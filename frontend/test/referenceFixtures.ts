import type { ReferenceCountry, ReferenceRegion } from '@mirhalgo/shared';

/** A small slice of the reference tables (MW_003 A2), shared by the unit and E2E tests. */

export const COUNTRIES: ReferenceCountry[] = [
  { code: 'EG', name: { ar: 'مصر', en: 'Egypt' }, dialCode: '20', companySignup: true },
  {
    code: 'SA',
    name: { ar: 'المملكة العربية السعودية', en: 'Saudi Arabia' },
    dialCode: '966',
    companySignup: true,
  },
  {
    code: 'AE',
    name: { ar: 'الإمارات العربية المتحدة', en: 'United Arab Emirates' },
    dialCode: '971',
    companySignup: true,
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

/** The answer of GET /api/reference/<list>?<query>, or null for an unknown list. */
export function referenceResponse(list: string, query: URLSearchParams): unknown[] | null {
  if (list === 'countries') return COUNTRIES;
  if (list === 'regions') {
    const country = query.get('country');
    return REGIONS.filter((r) => !country || r.countryCode === country);
  }
  return null;
}
