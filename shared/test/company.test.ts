import { describe, expect, it } from 'vitest';
import {
  COMPANY_COUNTRIES,
  COMPANY_COUNTRY_RULES,
  GOVERNORATES,
  TERMS_VERSION,
  checkFile,
  companyAccountStepSchema,
  companyLegalStepSchema,
  companyRegistrationSchema,
  companyServicesStepSchema,
  detectMime,
  formatLegalNumber,
  needsServicesStep,
  textSchema,
  toAsciiDigits,
  urlSchema,
} from '../src/index.js';

const account = {
  legalName: 'شركة النيل للشحن',
  representativeName: 'Ahmed Hassan',
  representativeTitle: 'General Manager',
  email: ' Ops@NileShip.COM ',
  phone: '+201012345678',
  whatsappSameAsMobile: true,
  whatsapp: '',
  landline: '',
  country: 'EG',
  region: 'EG-C',
  city: 'Nasr City',
  street: '12 Abbas El Akkad St.',
  website: '',
  password: 'Str0ng!pass',
  confirmPassword: 'Str0ng!pass',
  activities: ['international', 'domestic', 'china'],
  otherActivity: '',
};

const services = {
  international: { modes: ['air', 'sea'], scope: 'both', countries: ['CN'], regions: ['gulf'] },
  domestic: {
    allRegions: false,
    regions: ['EG-C', 'EG-GZ'],
    vehicleTypes: ['pickup'],
    vehicleTypeOther: '',
    fleetSize: '',
  },
  china: { sites: ['shein', '1688'], siteOther: '', services: ['consolidation'] },
  yearsInBusiness: '12',
};

const legal = { commercialRegisterNumber: '123456', taxNumber: '123-456-789' };
const review = { notes: '', confirmAccuracy: true, acceptTerms: true, termsVersion: TERMS_VERSION };
const application = { ...account, ...services, ...legal, ...review };

/** Error messages per field path, e.g. { 'domestic.regions': ['validation.selectAtLeastOne'] } */
function issues(result: {
  success: boolean;
  error?: { issues: { path: unknown[]; message: string }[] };
}) {
  const map: Record<string, string[]> = {};
  for (const issue of result.error?.issues ?? [])
    (map[issue.path.join('.')] ??= []).push(issue.message);
  return map;
}

describe('constants', () => {
  it('lists the 27 Egyptian governorates once each (still used by the mocked portal)', () => {
    expect(new Set(GOVERNORATES).size).toBe(27);
  });

  it('has legal-number rules for every company sign-up country', () => {
    expect(Object.keys(COMPANY_COUNTRY_RULES).sort()).toEqual([...COMPANY_COUNTRIES].sort());
  });

  it('skips Step 2 only when "Other" is the only activity', () => {
    expect(needsServicesStep(['other'])).toBe(false);
    expect(needsServicesStep(['other', 'china'])).toBe(true);
  });
});

describe('field helpers', () => {
  it('converts Arabic-Indic and Persian digits', () => {
    expect(toAsciiDigits('٠١٢٣٤٥٦٧٨٩ ۰۹')).toBe('0123456789 09');
  });

  it('rejects control characters and line breaks in single-line text', () => {
    const text = textSchema({ min: 2, max: 20 }, 'len');
    expect(text.safeParse('ok\u0000').success).toBe(false);
    expect(text.safeParse('two\nlines').success).toBe(false);
    expect(
      textSchema({ min: 1, max: 20 }, 'len', { multiline: true }).safeParse('a\nb').success,
    ).toBe(true);
  });

  it('accepts http(s) URLs only and adds https:// to a bare domain', () => {
    const url = urlSchema(300);
    expect(url.parse('facebook.com/nileship')).toBe('https://facebook.com/nileship');
    expect(url.parse('http://nileship.com')).toBe('http://nileship.com');
    for (const bad of ['javascript:alert(1)', 'ftp://x.com', 'localhost', 'https://']) {
      expect(url.safeParse(bad).success).toBe(false);
    }
  });

  it('masks the legal numbers while typing, per country', () => {
    expect(formatLegalNumber('EG', 'taxNumber', '1234')).toBe('123-4');
    expect(formatLegalNumber('EG', 'taxNumber', '123456789999')).toBe('123-456-789');
    expect(formatLegalNumber('SA', 'taxNumber', '٣٠٠ 000-0000000039')).toBe('300000000000003');
    expect(formatLegalNumber('SA', 'commercialRegisterNumber', '1010a12345678')).toBe('1010123456');
    expect(formatLegalNumber('AE', 'commercialRegisterNumber', 'cn-12 34_5')).toBe('CN-12345');
  });
});

describe('Step 1: account', () => {
  it('accepts a valid account and lowercases the email', () => {
    const result = companyAccountStepSchema.safeParse(account);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ email: 'ops@nileship.com' });
  });

  it.each([
    ['legalName', 'A', 'validation.companyNameLength'],
    ['legalName', 'x'.repeat(121), 'validation.companyNameLength'],
    ['representativeName', 'Al', 'validation.representativeNameLength'],
    ['representativeTitle', 'x'.repeat(61), 'validation.jobTitleLength'],
    ['city', 'x', 'validation.cityLength'],
    ['street', 'abcd', 'validation.streetLength'],
    ['landline', '123456', 'validation.landline'],
    ['landline', '1234567890123', 'validation.landline'],
    ['country', 'FR', 'validation.required'],
    ['region', '', 'validation.required'],
    ['region', 'cairo', 'validation.required'],
    ['region', 'SA-01', 'validation.required'], // a region of another country
    ['activities', [], 'validation.selectAtLeastOne'],
    ['activities', ['china', 'china'], 'validation.duplicate'],
  ])('rejects %s = %j', (field, value, message) => {
    expect(
      issues(companyAccountStepSchema.safeParse({ ...account, [field]: value }))[field],
    ).toContain(message);
  });

  it('accepts a Saudi or Emirati company with a region of its own country', () => {
    for (const [country, region] of [
      ['SA', 'SA-01'],
      ['AE', 'AE-DU'],
    ]) {
      expect(companyAccountStepSchema.safeParse({ ...account, country, region }).success).toBe(
        true,
      );
    }
  });

  it('accepts a landline with spaces/dashes and Arabic digits', () => {
    const result = companyAccountStepSchema.safeParse({ ...account, landline: '٠٢-٢٤ ١٥٦٧٨' });
    expect(result.data).toMatchObject({ landline: '022415678' });
  });

  it('requires the "Other" description only when "Other" is selected', () => {
    const withOther = { ...account, activities: ['other'] };
    expect(issues(companyAccountStepSchema.safeParse(withOther)).otherActivity).toEqual([
      'validation.required',
    ]);
    expect(companyAccountStepSchema.safeParse({ ...withOther, otherActivity: 'Ab' }).success).toBe(
      false,
    );
    expect(
      companyAccountStepSchema.safeParse({ ...withOther, otherActivity: 'Warehousing' }).success,
    ).toBe(true);
    // stale text (Other unticked) is dropped, even when invalid
    const stale = companyAccountStepSchema.safeParse({ ...account, otherActivity: 'x' });
    expect(stale.success).toBe(true);
    expect(stale.data).not.toHaveProperty('otherActivity');
  });

  it('rejects mismatched passwords and weak passwords', () => {
    expect(
      issues(companyAccountStepSchema.safeParse({ ...account, confirmPassword: 'Other1!pass' }))
        .confirmPassword,
    ).toEqual(['validation.passwordMismatch']);
    expect(
      companyAccountStepSchema.safeParse({ ...account, password: 'weak', confirmPassword: 'weak' })
        .success,
    ).toBe(false);
  });

  it('validates WhatsApp only when it is not the mobile number', () => {
    const own = { ...account, whatsappSameAsMobile: false };
    expect(companyAccountStepSchema.safeParse({ ...own, whatsapp: '+20101' }).success).toBe(false);
    expect(companyAccountStepSchema.safeParse({ ...own, whatsapp: '+201112345678' }).success).toBe(
      true,
    );
    expect(companyAccountStepSchema.safeParse({ ...account, whatsapp: '+20101' }).success).toBe(
      true,
    );
  });
});

describe('Step 2: services', () => {
  const step = (data: object) =>
    companyServicesStepSchema.safeParse({
      activities: account.activities,
      country: account.country,
      ...services,
      ...data,
    });

  it('accepts complete sections', () => {
    expect(step({}).success).toBe(true);
  });

  it('requires a section for every selected activity', () => {
    expect(issues(step({ china: undefined })).china).toEqual(['validation.required']);
  });

  it('ignores sections of unselected activities, even when invalid', () => {
    const result = companyServicesStepSchema.safeParse({
      activities: ['china'],
      country: 'EG',
      china: services.china,
      domestic: { vehicleTypes: [] },
    });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('domestic');
  });

  it('validates the international section', () => {
    const r = issues(
      step({ international: { modes: [], scope: 'everything', countries: ['XX'], regions: [] } }),
    );
    expect(r['international.modes']).toEqual(['validation.selectAtLeastOne']);
    expect(r['international.scope']).toEqual(['validation.required']);
    expect(r['international.countries.0']).toEqual(['validation.required']);
  });

  it('needs regions unless "All regions", which is stored as the flag only', () => {
    expect(
      issues(step({ domestic: { ...services.domestic, regions: [] } }))['domestic.regions'],
    ).toEqual(['validation.selectAtLeastOne']);
    const all = step({ domestic: { ...services.domestic, allRegions: true } });
    expect(all.data?.domestic).toMatchObject({ allRegions: true, regions: [] });
    expect(
      issues(step({ domestic: { ...services.domestic, regions: ['EG-C', 'EG-C'] } }))[
        'domestic.regions'
      ],
    ).toEqual(['validation.duplicate']);
  });

  it('drops covered regions of another country and the own country from "countries served"', () => {
    // e.g. the user switched from Egypt to Saudi Arabia after filling Step 2
    const result = step({
      country: 'SA',
      domestic: { ...services.domestic, regions: ['EG-C', 'SA-01'] },
      international: { ...services.international, countries: ['SA', 'CN'] },
    });
    expect(result.data?.domestic?.regions).toEqual(['SA-01']);
    expect(result.data?.international?.countries).toEqual(['CN']);
    // only stale values left: the "at least one" rule applies again
    expect(
      issues(step({ country: 'SA', domestic: { ...services.domestic, regions: ['EG-C'] } }))[
        'domestic.regions'
      ],
    ).toEqual(['validation.selectAtLeastOne']);
  });

  it('requires the "Other" text for vehicle types and China sites (3–100 chars)', () => {
    const vehicles = { ...services.domestic, vehicleTypes: ['other'] };
    expect(issues(step({ domestic: vehicles }))['domestic.vehicleTypeOther']).toEqual([
      'validation.required',
    ]);
    expect(step({ domestic: { ...vehicles, vehicleTypeOther: 'Ab' } }).success).toBe(false);
    expect(step({ domestic: { ...vehicles, vehicleTypeOther: 'Motorbikes' } }).success).toBe(true);

    const sites = { ...services.china, sites: ['other'] };
    expect(issues(step({ china: sites }))['china.siteOther']).toEqual(['validation.required']);
    expect(step({ china: { ...sites, siteOther: 'x'.repeat(101) } }).success).toBe(false);
  });

  it.each([
    ['yearsInBusiness', '101'],
    ['yearsInBusiness', '-1'],
    ['yearsInBusiness', '2.5'],
    ['yearsInBusiness', 'abc'],
  ])('rejects %s = %s', (field, value) => {
    expect(step({ [field]: value }).success).toBe(false);
  });

  it('parses optional numbers from form strings (empty = not given)', () => {
    expect(step({ yearsInBusiness: '' }).data).not.toHaveProperty(
      'yearsInBusiness',
      expect.anything(),
    );
    expect(
      step({ domestic: { ...services.domestic, fleetSize: '10000' } }).data?.domestic,
    ).toMatchObject({
      fleetSize: 10000,
    });
    expect(step({ domestic: { ...services.domestic, fleetSize: 10001 } }).success).toBe(false);
  });
});

describe('Step 3: legal (rules per country)', () => {
  const legalStep = (data: object) =>
    companyLegalStepSchema.safeParse({ country: 'EG', ...legal, ...data });
  const VALID = {
    EG: legal,
    SA: { commercialRegisterNumber: '1010123456', taxNumber: '300000000000003' },
    AE: { commercialRegisterNumber: 'CN-1234567', taxNumber: '100123456700003' },
  } as const;

  it.each([
    ['EG', '٧', '123 456 789', '7', '123456789'],
    ['SA', '1010 123456', '300-000-000-000-003', '1010123456', '300000000000003'],
    ['AE', ' cn-1234567 ', '100 1234 5670 0003', 'CN-1234567', '100123456700003'],
  ])('%s: accepts and normalises the numbers', (country, cr, tax, storedCr, storedTax) => {
    expect(legalStep({ country, commercialRegisterNumber: cr, taxNumber: tax }).data).toEqual({
      country,
      commercialRegisterNumber: storedCr,
      taxNumber: storedTax,
    });
  });

  it.each([
    [
      'EG',
      { commercialRegisterNumber: '12345678901' },
      'commercialRegisterNumber',
      'validation.legal.EG.registration',
    ],
    [
      'EG',
      { commercialRegisterNumber: '12a' },
      'commercialRegisterNumber',
      'validation.legal.EG.registration',
    ],
    ['EG', { commercialRegisterNumber: '' }, 'commercialRegisterNumber', 'validation.required'],
    ['EG', { taxNumber: '12345678' }, 'taxNumber', 'validation.legal.EG.tax'],
    ['EG', { taxNumber: '1234567890' }, 'taxNumber', 'validation.legal.EG.tax'],
    [
      'SA',
      { commercialRegisterNumber: '123456789' },
      'commercialRegisterNumber',
      'validation.legal.SA.registration',
    ],
    ['SA', { taxNumber: '123456789' }, 'taxNumber', 'validation.legal.SA.tax'],
    [
      'AE',
      { commercialRegisterNumber: 'AB' },
      'commercialRegisterNumber',
      'validation.legal.AE.registration',
    ],
    [
      'AE',
      { commercialRegisterNumber: '-1234' },
      'commercialRegisterNumber',
      'validation.legal.AE.registration',
    ],
    [
      'AE',
      { commercialRegisterNumber: 'CN_1234' },
      'commercialRegisterNumber',
      'validation.legal.AE.registration',
    ],
    ['AE', { taxNumber: '10012345670000' }, 'taxNumber', 'validation.legal.AE.tax'],
  ] as const)('%s: rejects %j', (country, data, field, message) => {
    expect(issues(legalStep({ country, ...VALID[country], ...data }))[field]).toEqual([message]);
  });

  it('an Egyptian tax card number is not a valid Saudi VAT number', () => {
    expect(issues(legalStep({ country: 'SA' })).taxNumber).toEqual(['validation.legal.SA.tax']);
  });
});

describe('full application', () => {
  it('accepts a complete application and normalises it', () => {
    const result = companyRegistrationSchema.safeParse(application);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      email: 'ops@nileship.com',
      whatsapp: '+201012345678', // same as mobile
      taxNumber: '123456789',
      yearsInBusiness: 12,
    });
  });

  it('works with "Other" only (no Step 2 data)', () => {
    const { international: _i, domestic: _d, china: _c, ...rest } = application;
    const result = companyRegistrationSchema.safeParse({
      ...rest,
      activities: ['other'],
      otherActivity: 'Warehousing',
    });
    expect(result.success).toBe(true);
  });

  it('requires both checkboxes and the current terms version', () => {
    const r = issues(
      companyRegistrationSchema.safeParse({
        ...application,
        confirmAccuracy: false,
        acceptTerms: false,
        termsVersion: '2020-01-01',
      }),
    );
    expect(r.confirmAccuracy).toEqual(['validation.declaration']);
    expect(r.acceptTerms).toEqual(['validation.terms']);
    expect(r.termsVersion).toEqual(['validation.termsVersion']);
  });

  it('limits notes to 1000 characters and keeps line breaks', () => {
    expect(
      companyRegistrationSchema.safeParse({ ...application, notes: 'x'.repeat(1001) }).success,
    ).toBe(false);
    const ok = companyRegistrationSchema.safeParse({ ...application, notes: 'Line 1\nLine 2' });
    expect(ok.data?.notes).toBe('Line 1\nLine 2');
  });

  it('strips unknown keys (nothing unexpected is stored)', () => {
    const result = companyRegistrationSchema.safeParse({
      ...application,
      role: 'admin',
      status: 'approved',
    });
    expect(result.data).not.toHaveProperty('role');
    expect(result.data).not.toHaveProperty('status');
  });

  it('rejects a non-object body', () => {
    expect(companyRegistrationSchema.safeParse(null).success).toBe(false);
    expect(companyRegistrationSchema.safeParse('[]').success).toBe(false);
  });
});

describe('files', () => {
  const bytes = (...values: number[]) => new Uint8Array(values);
  const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

  it('detects PDF, PNG, JPEG and WEBP by magic bytes', () => {
    expect(detectMime(bytes(...ascii('%PDF-1.7')))).toBe('application/pdf');
    expect(detectMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('image/png');
    expect(detectMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(detectMime(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBPVP8 ')))).toBe(
      'image/webp',
    );
  });

  it('rejects unknown or truncated content', () => {
    expect(detectMime(bytes(...ascii('MZ')))).toBeNull(); // .exe
    expect(detectMime(bytes(...ascii('<html>')))).toBeNull();
    expect(detectMime(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('AVI ')))).toBeNull();
    expect(detectMime(bytes(0xff, 0xd8))).toBeNull();
    expect(detectMime(bytes())).toBeNull();
  });

  it('checks type and size per document type', () => {
    const MB = 1024 * 1024;
    expect(checkFile({ size: 5 * MB, mime: 'application/pdf' }, 'tax_card')).toBeNull();
    expect(checkFile({ size: 5 * MB + 1, mime: 'application/pdf' }, 'tax_card')).toBe(
      'validation.fileSize',
    );
    expect(checkFile({ size: 0, mime: 'image/png' }, 'commercial_register')).toBe(
      'validation.fileSize',
    );
    expect(checkFile({ size: 100, mime: 'image/webp' }, 'customs_license')).toBe(
      'validation.fileType',
    );
    expect(checkFile({ size: 100, mime: null }, 'tax_card')).toBe('validation.fileType');
    expect(checkFile({ size: 2 * MB, mime: 'image/webp' }, 'logo')).toBeNull();
    expect(checkFile({ size: 2 * MB + 1, mime: 'image/png' }, 'logo')).toBe('validation.logoSize');
    expect(checkFile({ size: 100, mime: 'application/pdf' }, 'logo')).toBe('validation.logoType');
  });
});
