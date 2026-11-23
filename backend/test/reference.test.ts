import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* GET /api/reference/:list (MW_003 A2 + B1) + the company location check. Supabase is mocked. */

const COUNTRIES = [
  {
    code: 'EG',
    name_ar: 'مصر',
    name_en: 'Egypt',
    dial_code: '20',
    company_signup: true,
    china_delivery: true,
  },
  {
    code: 'SA',
    name_ar: 'السعودية',
    name_en: 'Saudi Arabia',
    dial_code: '966',
    company_signup: true,
    china_delivery: true,
  },
  // flagged in the DB but without legal-number rules in the shared code: never offered
  {
    code: 'KW',
    name_ar: 'الكويت',
    name_en: 'Kuwait',
    dial_code: '965',
    company_signup: true,
    china_delivery: true,
  },
  {
    code: 'FR',
    name_ar: 'فرنسا',
    name_en: 'France',
    dial_code: null,
    company_signup: false,
    china_delivery: false,
  },
];
const REGIONS = [
  { id: 'EG-C', country_code: 'EG', name_ar: 'القاهرة', name_en: 'Cairo' },
  { id: 'EG-GZ', country_code: 'EG', name_ar: 'الجيزة', name_en: 'Giza' },
  { id: 'SA-01', country_code: 'SA', name_ar: 'الرياض', name_en: 'Riyadh' },
];

const TABLES: Record<string, unknown[]> = {
  countries: COUNTRIES,
  regions: REGIONS,
  cities: [
    { id: 'EG-CAIRO', country_code: 'EG', name_ar: 'القاهرة', name_en: 'Cairo' },
    { id: 'SA-JEDDAH', country_code: 'SA', name_ar: 'جدة', name_en: 'Jeddah' },
  ],
  ports: [
    {
      id: 'EG-ALEXANDRIA',
      country_code: 'EG',
      unlocode: 'EGALY',
      name_ar: 'الإسكندرية',
      name_en: 'Alexandria',
    },
    {
      id: 'EG-ABU_QIR',
      country_code: 'EG',
      unlocode: null,
      name_ar: 'أبو قير',
      name_en: 'Abu Qir',
    },
    { id: 'SA-JEDDAH', country_code: 'SA', unlocode: 'SAJED', name_ar: 'جدة', name_en: 'Jeddah' },
  ],
  airports: [
    {
      id: 'CAI',
      country_code: 'EG',
      name_ar: 'مطار القاهرة الدولي',
      name_en: 'Cairo International',
    },
  ],
  container_types: [
    { id: '40_high_cube', name_ar: 'حاوية ٤٠ قدمًا عالية', name_en: "40' High Cube" },
  ],
  truck_types: [{ id: 'tanker', name_ar: 'صهريج', name_en: 'Tanker' }],
  shipping_lines: [{ id: 'maersk', name_ar: 'Maersk', name_en: 'Maersk' }],
  transit_estimates: [{ source: 'shein', method: 'air', min_days: 10, max_days: 15 }],
};

const loads = vi.fn();
let failNext = false;

vi.mock('../src/lib/supabase.js', () => ({
  db: {
    from: (table: string) => {
      loads(table);
      const result = failNext
        ? { data: null, error: new Error('db down') }
        : { data: TABLES[table], error: null };
      failNext = false;
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      return builder;
    },
  },
}));
vi.spyOn(console, 'error').mockImplementation(() => {});

const { createApp } = await import('../src/app.js');
const reference = await import('../src/services/reference.js');
const app = createApp();

beforeEach(() => {
  reference.clearReferenceCache();
  loads.mockClear();
});

describe('GET /api/reference/:list', () => {
  it('countries: mapped to { code, name: { ar, en }, dialCode, companySignup }, cacheable', async () => {
    const res = await request(app).get('/api/reference/countries');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=600');
    expect(res.body.data).toHaveLength(4);
    expect(res.body.data[0]).toEqual({
      code: 'EG',
      name: { ar: 'مصر', en: 'Egypt' },
      dialCode: '20',
      companySignup: true,
      chinaDelivery: true,
    });
  });

  it('countries?scope=company_signup: flagged AND with legal rules in the code', async () => {
    const res = await request(app).get('/api/reference/countries?scope=company_signup');
    expect(res.body.data.map((c: { code: string }) => c.code)).toEqual(['EG', 'SA']);
  });

  it('countries?scope=china_delivery: the SHEIN / Chinese sites delivery countries', async () => {
    const res = await request(app).get('/api/reference/countries?scope=china_delivery');
    expect(res.body.data.map((c: { code: string }) => c.code)).toEqual(['EG', 'SA', 'KW']);
  });

  it('B1 lists: cities / ports / airports by country, option lists, transit estimates', async () => {
    const get = async (path: string) =>
      (await request(app).get(`/api/reference/${path}`)).body.data;
    expect(await get('cities?country=SA')).toEqual([
      { id: 'SA-JEDDAH', countryCode: 'SA', name: { ar: 'جدة', en: 'Jeddah' } },
    ]);
    expect(await get('ports?country=EG')).toEqual([
      {
        id: 'EG-ALEXANDRIA',
        countryCode: 'EG',
        unlocode: 'EGALY',
        name: { ar: 'الإسكندرية', en: 'Alexandria' },
      },
      {
        id: 'EG-ABU_QIR',
        countryCode: 'EG',
        unlocode: null,
        name: { ar: 'أبو قير', en: 'Abu Qir' },
      },
    ]);
    expect(await get('ports')).toHaveLength(3); // no country = all
    expect((await get('airports?country=EG'))[0]).toMatchObject({ id: 'CAI', countryCode: 'EG' });
    expect(await get('truck-types')).toEqual([
      { id: 'tanker', name: { ar: 'صهريج', en: 'Tanker' } },
    ]);
    expect(await get('shipping-lines')).toEqual([
      { id: 'maersk', name: { ar: 'Maersk', en: 'Maersk' } },
    ]);
    expect(await get('container-types')).toHaveLength(1);
    expect(await get('transit-estimates')).toEqual([
      { source: 'shein', method: 'air', minDays: 10, maxDays: 15 },
    ]);
    // ?country= is ignored by lists without a country
    expect(await get('truck-types?country=EG')).toHaveLength(1);
  });

  it('regions?country=EG: only that country', async () => {
    const res = await request(app).get('/api/reference/regions?country=EG');
    expect(res.body.data).toEqual([
      { id: 'EG-C', countryCode: 'EG', name: { ar: 'القاهرة', en: 'Cairo' } },
      { id: 'EG-GZ', countryCode: 'EG', name: { ar: 'الجيزة', en: 'Giza' } },
    ]);
  });

  it('unknown list → 404, invalid query → 400', async () => {
    expect((await request(app).get('/api/reference/planets')).status).toBe(404);
    expect((await request(app).get('/api/reference/regions?country=egypt')).status).toBe(400);
    expect((await request(app).get('/api/reference/countries?scope=everything')).status).toBe(400);
  });

  it('loads each table once (in-memory cache), and never caches a failed load', async () => {
    await request(app).get('/api/reference/regions?country=EG');
    await request(app).get('/api/reference/regions?country=SA');
    expect(loads).toHaveBeenCalledTimes(1);

    reference.clearReferenceCache();
    failNext = true;
    expect((await request(app).get('/api/reference/countries')).status).toBe(500);
    expect((await request(app).get('/api/reference/countries')).status).toBe(200);
  });
});

describe('assertCompanyLocation', () => {
  const ok = { country: 'EG', region: 'EG-C', domestic: { regions: ['EG-C', 'EG-GZ'] } };
  const status = (app: Parameters<typeof reference.assertCompanyLocation>[0]) =>
    reference.assertCompanyLocation(app).then(
      () => 'ok',
      (error: { code?: string }) => error.code,
    );

  it('accepts a sign-up country with its own existing regions', async () => {
    expect(await status(ok)).toBe('ok');
    expect(await status({ country: 'SA', region: 'SA-01' })).toBe('ok');
  });

  it.each([
    ['a country not open for sign-up', { ...ok, country: 'FR', region: 'FR-75' }],
    ['a flagged country without rules', { country: 'KW', region: 'KW-KU' }],
    ['a region that does not exist', { ...ok, region: 'EG-XX' }],
    ['a region of another country', { ...ok, region: 'SA-01' }],
    ['a covered region that does not exist', { ...ok, domestic: { regions: ['EG-XX'] } }],
  ])('rejects %s with 400 VALIDATION_ERROR', async (_name, app) => {
    expect(await status(app)).toBe('VALIDATION_ERROR');
  });

  it('formats a region for the team inbox', async () => {
    expect(await reference.regionLabel('EG-GZ')).toBe('Giza (EG)');
    expect(await reference.regionLabel('EG-XX')).toBe('EG-XX');
  });
});
