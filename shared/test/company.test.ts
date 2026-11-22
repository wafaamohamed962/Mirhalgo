import { describe, expect, it } from 'vitest';
import {
  GOVERNORATES,
  TERMS_VERSION,
  checkFile,
  companyAccountStepSchema,
  companyLegalStepSchema,
  companyRegistrationSchema,
  companyServicesStepSchema,
  detectMime,
  formatTaxNumber,
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
  governorate: 'cairo',
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
    allGovernorates: false,
    governorates: ['cairo', 'giza'],
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

/** Error messages per field path, e.g. { 'domestic.governorates': ['validation.selectAtLeastOne'] } */
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
  it('lists the 27 Egyptian governorates once each', () => {
    expect(new Set(GOVERNORATES).size).toBe(27);
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

  it('masks the tax number as XXX-XXX-XXX while typing', () => {
    expect(formatTaxNumber('1234')).toBe('123-4');
    expect(formatTaxNumber('123456789999')).toBe('123-456-789');
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
    ['governorate', 'atlantis', 'validation.required'],
    ['activities', [], 'validation.selectAtLeastOne'],
    ['activities', ['china', 'china'], 'validation.duplicate'],
  ])('rejects %s = %j', (field, value, message) => {
    expect(
      issues(companyAccountStepSchema.safeParse({ ...account, [field]: value }))[field],
    ).toContain(message);
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
    companyServicesStepSchema.safeParse({ activities: account.activities, ...services, ...data });

  it('accepts complete sections', () => {
    expect(step({}).success).toBe(true);
  });

  it('requires a section for every selected activity', () => {
    expect(issues(step({ china: undefined })).china).toEqual(['validation.required']);
  });

  it('ignores sections of unselected activities, even when invalid', () => {
    const result = companyServicesStepSchema.safeParse({
      activities: ['china'],
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

  it('needs governorates unless "All governorates", which is stored as the flag only', () => {
    expect(
      issues(step({ domestic: { ...services.domestic, governorates: [] } }))[
        'domestic.governorates'
      ],
    ).toEqual(['validation.selectAtLeastOne']);
    const all = step({ domestic: { ...services.domestic, allGovernorates: true } });
    expect(all.data?.domestic).toMatchObject({ allGovernorates: true, governorates: [] });
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

describe('Step 3: legal', () => {
  it('accepts 1–10 digit commercial register numbers and a 9-digit tax number', () => {
    expect(
      companyLegalStepSchema.parse({ commercialRegisterNumber: '٧', taxNumber: '123 456 789' }),
    ).toEqual({
      commercialRegisterNumber: '7',
      taxNumber: '123456789',
    });
  });

  it.each([
    [
      { commercialRegisterNumber: '12345678901' },
      'commercialRegisterNumber',
      'validation.commercialRegister',
    ],
    [
      { commercialRegisterNumber: '12a' },
      'commercialRegisterNumber',
      'validation.commercialRegister',
    ],
    [{ commercialRegisterNumber: '' }, 'commercialRegisterNumber', 'validation.required'],
    [{ taxNumber: '12345678' }, 'taxNumber', 'validation.taxNumber'],
    [{ taxNumber: '1234567890' }, 'taxNumber', 'validation.taxNumber'],
  ])('rejects %j', (data, field, message) => {
    expect(issues(companyLegalStepSchema.safeParse({ ...legal, ...data }))[field]).toEqual([
      message,
    ]);
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
