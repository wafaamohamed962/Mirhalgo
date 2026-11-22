import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearCompanyDraft,
  loadCompanyDraft,
  saveCompanyDraft,
  withDraft,
} from '../src/features/companyRegistration/draft';
import { EMPTY_VALUES, type CompanyFormValues } from '../src/features/companyRegistration/model';

/* Decision 7: what the autosaved draft may contain, and for how long. */

const DAY = 24 * 60 * 60 * 1000;
const values = {
  ...EMPTY_VALUES,
  legalName: 'Nile Shipping',
  password: 'Str0ng!pass',
  confirmPassword: 'Str0ng!pass',
  commercialRegisterNumber: '12345',
  taxNumber: '123-456-789',
  confirmAccuracy: true,
  acceptTerms: true,
  files: { tax_card: new File(['%PDF-'], 'tax.pdf') },
  domestic: { ...EMPTY_VALUES.domestic, vehicleTypes: ['pickup'] },
} as CompanyFormValues;

beforeEach(() => localStorage.clear());

describe('company draft', () => {
  it('never stores passwords, legal numbers, files or the consents', () => {
    saveCompanyDraft(values);
    const raw = localStorage.getItem('mirhalgo.companyDraft') ?? '';
    expect(raw).toContain('Nile Shipping');
    for (const secret of [
      'Str0ng!pass',
      '12345',
      '123-456-789',
      'tax.pdf',
      'confirmAccuracy',
      'acceptTerms',
    ]) {
      expect(raw).not.toContain(secret);
    }
  });

  it('restores the text fields on top of the empty form', () => {
    saveCompanyDraft(values);
    const draft = loadCompanyDraft();
    const restored = withDraft(EMPTY_VALUES, draft!.values);
    expect(restored.legalName).toBe('Nile Shipping');
    expect(restored.domestic).toMatchObject({ vehicleTypes: ['pickup'], regions: [] });
    expect(restored.password).toBe('');
    expect(restored.files).toEqual({});
  });

  it('drops regions that do not belong to the saved country (MW_003 A2)', () => {
    const restored = withDraft(EMPTY_VALUES, {
      country: 'SA',
      region: 'EG-C',
      domestic: { ...EMPTY_VALUES.domestic, vehicleTypes: ['pickup'], regions: ['EG-C', 'SA-01'] },
    } as Parameters<typeof withDraft>[1]);
    expect(restored.region).toBe('');
    expect(restored.domestic?.regions).toEqual(['SA-01']);
  });

  it('expires after 7 days and drops corrupt drafts', () => {
    const now = Date.now();
    saveCompanyDraft(values, now - 7 * DAY + 1000);
    expect(loadCompanyDraft(now)).not.toBeNull();
    saveCompanyDraft(values, now - 7 * DAY - 1);
    expect(loadCompanyDraft(now)).toBeNull();
    expect(localStorage.getItem('mirhalgo.companyDraft')).toBeNull();

    localStorage.setItem('mirhalgo.companyDraft', '{not json');
    expect(loadCompanyDraft()).toBeNull();
    localStorage.setItem('mirhalgo.companyDraft', JSON.stringify({ savedAt: 'x', values: 1 }));
    expect(loadCompanyDraft()).toBeNull();
  });

  it('clearCompanyDraft removes it', () => {
    saveCompanyDraft(values);
    clearCompanyDraft();
    expect(loadCompanyDraft()).toBeNull();
  });
});
