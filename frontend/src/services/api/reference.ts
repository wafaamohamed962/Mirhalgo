import { useQuery } from '@tanstack/react-query';
import type {
  CountryScope,
  LocalizedName,
  ReferenceCountry,
  ReferenceList,
  ReferenceLists,
  ReferenceRegion,
} from '@mirhalgo/shared';
import type { ComboboxOption } from '../../components/ui/Combobox';
import { apiRequest } from '../../lib/apiClient';

/*
 * Reference lists (MW_003 A2 + B1): public, cached on the server and here (they change only
 * through migrations), never hard-coded in components.
 */

export type ReferenceParams = { country?: string; scope?: CountryScope };

export function fetchReference<L extends ReferenceList>(list: L, params: ReferenceParams = {}) {
  const query = new URLSearchParams();
  if (params.scope) query.set('scope', params.scope);
  if (params.country) query.set('country', params.country);
  const search = query.toString();
  return apiRequest<ReferenceLists[L][]>('GET', `/reference/${list}${search ? `?${search}` : ''}`);
}

export const referenceKeys = {
  list: (list: ReferenceList, params: ReferenceParams = {}) =>
    ['reference', list, params.country ?? '', params.scope ?? ''] as const,
};

const HOUR = 60 * 60 * 1000;

/** One reference list (cached for an hour); idle while `enabled` is false. */
export const useReference = <L extends ReferenceList>(
  list: L,
  params: ReferenceParams = {},
  { enabled = true }: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: referenceKeys.list(list, params),
    queryFn: () => fetchReference(list, params),
    enabled,
    staleTime: HOUR,
  });

export const useCountries = (scope: CountryScope = 'all') => useReference('countries', { scope });

/** Regions of one country; idle until a country is chosen. */
export const useRegions = (country: string | undefined) =>
  useReference('regions', { country }, { enabled: Boolean(country) });

/** The name in the current language (Arabic for "ar", English otherwise). */
export const localizedName = (name: LocalizedName, language: string) =>
  language.startsWith('ar') ? name.ar : name.en;

const otherName = (name: LocalizedName, language: string) =>
  language.startsWith('ar') ? name.en : name.ar;

/** Region options for a select / checkbox list, sorted by their name in the current language. */
export function regionOptions(regions: readonly ReferenceRegion[], language: string) {
  const collator = new Intl.Collator(language);
  return regions
    .map((region) => ({ value: region.id, label: localizedName(region.name, language) }))
    .sort((a, b) => collator.compare(a.label, b.label));
}

type Named = { id: string; name: LocalizedName; countryCode?: string };

/**
 * Combobox options of any reference list: localized label, flag of the item's country,
 * and the other language's name as a search keyword ("cairo" finds "القاهرة").
 * `code` adds a visible, searchable code (IATA, UN/LOCODE).
 */
export function comboboxOptions<T extends Named>(
  items: readonly T[],
  language: string,
  { code, flags = true }: { code?: (item: T) => string | null | undefined; flags?: boolean } = {},
): ComboboxOption[] {
  return items.map((item) => ({
    value: item.id,
    label: localizedName(item.name, language),
    keywords: otherName(item.name, language),
    hint: code?.(item) ?? undefined,
    flag: flags ? item.countryCode : undefined,
  }));
}

/** Country options (server order: sign-up / delivery countries first), with flags. */
export const countryOptions = (countries: readonly ReferenceCountry[], language: string) =>
  comboboxOptions(
    countries.map((country) => ({ ...country, id: country.code, countryCode: country.code })),
    language,
  );
