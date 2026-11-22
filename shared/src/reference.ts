/**
 * Reference lists (MW_003 A2 + B1): served by GET /api/reference/:list from the reference
 * tables, cached. Names come in both languages; the web picks one by the current language.
 */

export type LocalizedName = { ar: string; en: string };

export type ReferenceCountry = {
  /** ISO 3166-1 alpha-2, e.g. "EG". */
  code: string;
  name: LocalizedName;
  /** Without "+", e.g. "20"; null when not known yet. */
  dialCode: string | null;
  /** A shipping company can register from this country. */
  companySignup: boolean;
};

export type ReferenceRegion = {
  /** ISO 3166-2, e.g. "EG-C". */
  id: string;
  countryCode: string;
  name: LocalizedName;
};

/** Lists available at /api/reference/:list (B1 adds ports, airports, …). */
export const REFERENCE_LISTS = ['countries', 'regions'] as const;
export type ReferenceList = (typeof REFERENCE_LISTS)[number];

/** `?scope=` of the countries list. */
export const COUNTRY_SCOPES = ['all', 'company_signup'] as const;
export type CountryScope = (typeof COUNTRY_SCOPES)[number];
