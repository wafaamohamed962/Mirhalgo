import { useQuery } from '@tanstack/react-query';
import type {
  CountryScope,
  LocalizedName,
  ReferenceCountry,
  ReferenceRegion,
} from '@mirhalgo/shared';
import { apiRequest } from '../../lib/apiClient';

/*
 * Reference lists (MW_003 A2, B1): public, cached on the server and here (they change only
 * through migrations), never hard-coded in components.
 */

export const referenceApi = {
  countries: (scope: CountryScope = 'all') =>
    apiRequest<ReferenceCountry[]>('GET', `/reference/countries?scope=${scope}`),
  regions: (country: string) =>
    apiRequest<ReferenceRegion[]>(
      'GET',
      `/reference/regions?country=${encodeURIComponent(country)}`,
    ),
};

const HOUR = 60 * 60 * 1000;

export const referenceKeys = {
  countries: (scope: CountryScope) => ['reference', 'countries', scope] as const,
  regions: (country: string) => ['reference', 'regions', country] as const,
};

export const useCountries = (scope: CountryScope = 'all') =>
  useQuery({
    queryKey: referenceKeys.countries(scope),
    queryFn: () => referenceApi.countries(scope),
    staleTime: HOUR,
  });

/** Regions of one country; idle until a country is chosen. */
export const useRegions = (country: string | undefined) =>
  useQuery({
    queryKey: referenceKeys.regions(country ?? ''),
    queryFn: () => referenceApi.regions(country!),
    enabled: Boolean(country),
    staleTime: HOUR,
  });

/** The name in the current language (Arabic for "ar", English otherwise). */
export const localizedName = (name: LocalizedName, language: string) =>
  language.startsWith('ar') ? name.ar : name.en;

/** Region options for a select / checkbox list, sorted by their name in the current language. */
export function regionOptions(regions: readonly ReferenceRegion[], language: string) {
  const collator = new Intl.Collator(language);
  return regions
    .map((region) => ({ value: region.id, label: localizedName(region.name, language) }))
    .sort((a, b) => collator.compare(a.label, b.label));
}
