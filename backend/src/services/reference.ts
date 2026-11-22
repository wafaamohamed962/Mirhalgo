import {
  isCompanyCountry,
  regionBelongsTo,
  type CountryScope,
  type ReferenceCountry,
  type ReferenceRegion,
} from '@mirhalgo/shared';
import { db } from '../lib/supabase.js';
import { HttpError } from '../middleware/errorHandler.js';

/*
 * Reference lists (MW_003 A2, extended in B1): small, public, rarely changing tables, so each
 * one is loaded once and kept in memory for CACHE_TTL_MS (a DB edit shows up within that time).
 * A failed load is not cached.
 */

export const CACHE_TTL_MS = 10 * 60 * 1000;

function cached<T>(load: () => Promise<T>): { get: () => Promise<T>; clear: () => void } {
  let entry: { at: number; value: Promise<T> } | null = null;
  return {
    get() {
      if (!entry || Date.now() - entry.at > CACHE_TTL_MS) {
        const value = load();
        entry = { at: Date.now(), value };
        value.catch(() => {
          if (entry?.value === value) entry = null;
        });
      }
      return entry.value;
    },
    clear() {
      entry = null;
    },
  };
}

const countries = cached(async (): Promise<ReferenceCountry[]> => {
  const { data, error } = await db
    .from('countries')
    .select('code, name_ar, name_en, dial_code, company_signup')
    .eq('active', true)
    .order('sort')
    .order('name_en');
  if (error) throw error;
  return data.map((row) => ({
    code: row.code,
    name: { ar: row.name_ar, en: row.name_en },
    dialCode: row.dial_code,
    companySignup: row.company_signup,
  }));
});

const regions = cached(async (): Promise<ReferenceRegion[]> => {
  const { data, error } = await db
    .from('regions')
    .select('id, country_code, name_ar, name_en')
    .eq('active', true)
    .order('sort')
    .order('name_en');
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    countryCode: row.country_code,
    name: { ar: row.name_ar, en: row.name_en },
  }));
});

/** For tests. */
export function clearReferenceCache() {
  countries.clear();
  regions.clear();
}

/**
 * Countries. `company_signup`: the countries flagged in the DB that also have legal-number
 * rules in the shared code (a flag without rules is never offered).
 */
export async function listCountries(scope: CountryScope = 'all'): Promise<ReferenceCountry[]> {
  const all = await countries.get();
  return scope === 'company_signup'
    ? all.filter((country) => country.companySignup && isCompanyCountry(country.code))
    : all;
}

/** Regions, optionally of one country. */
export async function listRegions(countryCode?: string): Promise<ReferenceRegion[]> {
  const all = await regions.get();
  return countryCode ? all.filter((region) => region.countryCode === countryCode) : all;
}

const invalid = () => new HttpError(400, 'VALIDATION_ERROR', 'Invalid input');

/**
 * Server-side check of what the shared schema cannot know: the company country is open for
 * sign-up, and its region and covered regions exist (and belong to it). The database enforces
 * the same with foreign keys; this turns a tampered or stale request into a clean 400.
 */
export async function assertCompanyLocation(app: {
  country: string;
  region: string;
  domestic?: { regions: readonly string[] };
}): Promise<void> {
  const signup = await listCountries('company_signup');
  if (!signup.some((country) => country.code === app.country)) throw invalid();
  const known = new Set((await listRegions(app.country)).map((region) => region.id));
  const wanted = [app.region, ...(app.domestic?.regions ?? [])];
  if (wanted.some((id) => !regionBelongsTo(id, app.country) || !known.has(id))) throw invalid();
}

/** "Giza (EG)" for the team inbox; the id when the region is unknown. */
export async function regionLabel(regionId: string): Promise<string> {
  const region = (await listRegions()).find((r) => r.id === regionId);
  return region ? `${region.name.en} (${region.countryCode})` : regionId;
}
