import {
  COUNTRY_FILTERED_LISTS,
  isCompanyCountry,
  regionBelongsTo,
  type CountryScope,
  type LocalizedName,
  type ReferenceCountry,
  type ReferenceList,
  type ReferenceLists,
  type ReferenceRegion,
} from '@mirhalgo/shared';
import { db } from '../lib/supabase.js';
import { HttpError } from '../middleware/errorHandler.js';

/*
 * Reference lists (MW_003 A2 + B1): small, public, rarely changing tables, so each one is
 * loaded once and kept in memory for CACHE_TTL_MS (a DB edit shows up within that time).
 * A failed load is not cached. Only active rows, ordered by `sort` then the English name.
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

/** Unwraps a Supabase query result (throws its error). */
async function rows<T>(query: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

const name = (row: { name_ar: string; name_en: string }): LocalizedName => ({
  ar: row.name_ar,
  en: row.name_en,
});

/** Options of a plain list (container types, truck types, shipping lines). */
const optionList = (table: 'container_types' | 'truck_types' | 'shipping_lines') => async () =>
  (
    await rows(
      db
        .from(table)
        .select('id, name_ar, name_en')
        .eq('active', true)
        .order('sort')
        .order('name_en'),
    )
  ).map((row) => ({ id: row.id, name: name(row) }));

/** Countries, regions, cities, ports and airports share id + country + names. */
const placeList = (table: 'regions' | 'cities' | 'airports') => async () =>
  (
    await rows(
      db
        .from(table)
        .select('id, country_code, name_ar, name_en')
        .eq('active', true)
        .order('sort')
        .order('name_en'),
    )
  ).map((row) => ({ id: row.id, countryCode: row.country_code, name: name(row) }));

const LOADERS: { [L in ReferenceList]: () => Promise<ReferenceLists[L][]> } = {
  countries: async () =>
    (
      await rows(
        db
          .from('countries')
          .select('code, name_ar, name_en, dial_code, company_signup, china_delivery')
          .eq('active', true)
          .order('sort')
          .order('name_en'),
      )
    ).map((row) => ({
      code: row.code,
      name: name(row),
      dialCode: row.dial_code,
      companySignup: row.company_signup,
      chinaDelivery: row.china_delivery,
    })),
  regions: placeList('regions'),
  cities: placeList('cities'),
  airports: placeList('airports'),
  ports: async () =>
    (
      await rows(
        db
          .from('ports')
          .select('id, country_code, unlocode, name_ar, name_en')
          .eq('active', true)
          .order('sort')
          .order('name_en'),
      )
    ).map((row) => ({
      id: row.id,
      countryCode: row.country_code,
      unlocode: row.unlocode,
      name: name(row),
    })),
  'container-types': optionList('container_types'),
  'truck-types': optionList('truck_types'),
  'shipping-lines': optionList('shipping_lines'),
  'transit-estimates': async () =>
    (
      await rows(
        db
          .from('transit_estimates')
          .select('source, method, min_days, max_days')
          .eq('active', true)
          .order('source')
          .order('method'),
      )
    ).map((row) => ({
      source: row.source,
      method: row.method,
      minDays: row.min_days,
      maxDays: row.max_days,
    })),
};

type Cache<T> = { get: () => Promise<T>; clear: () => void };

// one cache per list (built from LOADERS; the mapped type keeps each list's item type)
const caches = Object.fromEntries(
  (Object.keys(LOADERS) as ReferenceList[]).map((list) => [
    list,
    cached(LOADERS[list] as () => Promise<unknown>),
  ]),
) as unknown as { [L in ReferenceList]: Cache<ReferenceLists[L][]> };

/** For tests. */
export function clearReferenceCache() {
  for (const cache of Object.values(caches)) cache.clear();
}

export type ReferenceQuery = { country?: string; scope?: CountryScope };

const hasCountry = (list: ReferenceList): list is (typeof COUNTRY_FILTERED_LISTS)[number] =>
  (COUNTRY_FILTERED_LISTS as readonly string[]).includes(list);

/**
 * One reference list. `country` filters regions, cities, ports and airports. Countries'
 * `company_signup` scope = flagged in the DB AND with legal-number rules in the shared code
 * (a flag without rules is never offered).
 */
export async function listReference<L extends ReferenceList>(
  list: L,
  { country, scope = 'all' }: ReferenceQuery = {},
): Promise<ReferenceLists[L][]> {
  const items = await caches[list].get();
  if (list === 'countries') {
    const countries = items as ReferenceCountry[];
    const kept =
      scope === 'company_signup'
        ? countries.filter((c) => c.companySignup && isCompanyCountry(c.code))
        : scope === 'china_delivery'
          ? countries.filter((c) => c.chinaDelivery)
          : countries;
    return kept as ReferenceLists[L][];
  }
  if (country && hasCountry(list)) {
    return (items as Array<{ countryCode: string }>).filter(
      (item) => item.countryCode === country,
    ) as ReferenceLists[L][];
  }
  return items;
}

export const listCountries = (scope: CountryScope = 'all') => listReference('countries', { scope });
export const listRegions = (country?: string): Promise<ReferenceRegion[]> =>
  listReference('regions', { country });

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
