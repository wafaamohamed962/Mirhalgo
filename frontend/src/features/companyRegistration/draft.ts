import type { DefaultValues } from 'react-hook-form';
import type { CompanyFormValues } from './model';

/*
 * Autosaved draft of the company registration (MW_002 A1 + decision 7), in localStorage:
 * never passwords, files, legal numbers or the consent checkboxes; expires after 7 days;
 * cleared after a successful submit and on logout.
 */

const STORAGE_KEY = 'mirhalgo.companyDraft';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const EXCLUDED = [
  'password',
  'confirmPassword',
  'commercialRegisterNumber',
  'taxNumber',
  'files',
  'confirmAccuracy',
  'acceptTerms',
  'termsVersion',
] as const satisfies ReadonlyArray<keyof CompanyFormValues>;

export type DraftValues = Omit<CompanyFormValues, (typeof EXCLUDED)[number]>;
export type CompanyDraft = { savedAt: number; values: Partial<DraftValues> };

export function toDraftValues(values: CompanyFormValues): DraftValues {
  const draft: Record<string, unknown> = { ...values };
  for (const key of EXCLUDED) delete draft[key];
  return draft as DraftValues;
}

export function saveCompanyDraft(values: CompanyFormValues, now = Date.now()) {
  try {
    const draft: CompanyDraft = { savedAt: now, values: toDraftValues(values) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // storage full or blocked: autosave is best effort
  }
}

export function loadCompanyDraft(now = Date.now()): CompanyDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<CompanyDraft>;
    const valid =
      typeof draft.savedAt === 'number' &&
      typeof draft.values === 'object' &&
      draft.values !== null &&
      now - draft.savedAt < TTL_MS;
    if (valid) return draft as CompanyDraft;
  } catch {
    // corrupt draft: drop it below
  }
  clearCompanyDraft();
  return null;
}

export function clearCompanyDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Draft values on top of the empty form (sections merged one level deep). */
export function withDraft(
  empty: DefaultValues<CompanyFormValues>,
  draft: Partial<DraftValues>,
): DefaultValues<CompanyFormValues> {
  return {
    ...empty,
    ...draft,
    international: { ...empty.international, ...draft.international },
    domestic: { ...empty.domestic, ...draft.domestic },
    china: { ...empty.china, ...draft.china },
  };
}
