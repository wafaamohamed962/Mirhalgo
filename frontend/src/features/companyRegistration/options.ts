import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, MoreHorizontal, ShoppingBag, Truck, type LucideIcon } from 'lucide-react';
import {
  CHINA_SERVICES,
  CHINA_SITES,
  COMPANY_ACTIVITIES,
  COMPANY_COUNTRY_RULES,
  COUNTRIES,
  INTERNATIONAL_MODES,
  INTERNATIONAL_SCOPES,
  SERVICE_REGIONS,
  VEHICLE_TYPES,
  isCompanyCountry,
  type CompanyActivity,
  type CompanyCountry,
  type DocumentType,
} from '@mirhalgo/shared';
import type { ChoiceOption } from '../../components/ui';

const ACTIVITY_ICONS: Record<CompanyActivity, LucideIcon> = {
  international: Globe,
  domestic: Truck,
  china: ShoppingBag,
  other: MoreHorizontal,
};

/** i18n group of each option list (`options.<group>.<value>`). */
const GROUPS = {
  modes: ['internationalMode', INTERNATIONAL_MODES],
  scopes: ['internationalScope', INTERNATIONAL_SCOPES],
  regions: ['region', SERVICE_REGIONS],
  vehicles: ['vehicle', VEHICLE_TYPES],
  chinaSites: ['chinaSite', CHINA_SITES],
  chinaServices: ['chinaService', CHINA_SERVICES],
} as const;

type Groups = typeof GROUPS;
type Options = { [K in keyof Groups]: ChoiceOption<Groups[K][1][number]>[] } & {
  activities: ChoiceOption<CompanyActivity>[];
  countries: ChoiceOption[];
};

/** Translated option lists for the wizard (labels follow the current language). */
export function useCompanyOptions(): Options {
  const { t, i18n } = useTranslation();

  return useMemo(() => {
    const regionNames = new Intl.DisplayNames([i18n.language], { type: 'region' });
    const lists = Object.fromEntries(
      Object.entries(GROUPS).map(([name, [group, values]]) => [
        name,
        values.map((value) => ({ value, label: t(`options.${group}.${value}`) })),
      ]),
    ) as { [K in keyof Groups]: ChoiceOption<Groups[K][1][number]>[] };

    return {
      ...lists,
      activities: COMPANY_ACTIVITIES.map((value) => ({
        value,
        label: t(`options.activity.${value}`),
        description: t(`options.activityDescription.${value}`),
        icon: ACTIVITY_ICONS[value],
      })),
      // the company's own country is filtered out where it is shown (MW_003 A2)
      countries: COUNTRIES.map((c) => ({
        value: c.iso,
        label: regionNames.of(c.iso) ?? c.iso,
      })),
    };
  }, [t, i18n.language]);
}

/** Labels of the selected values as a localized list for the review step ("Air and Sea"). */
export function labelsOf(
  options: ReadonlyArray<ChoiceOption>,
  values: readonly string[] = [],
  language: string,
) {
  const labels = options
    .filter((option) => values.includes(option.value))
    .map((option) => String(option.label));
  return new Intl.ListFormat(language, { type: 'conjunction' }).format(labels);
}

// ── per-country copy (MW_003 A2) ──────────────────────────────────────────

/** Governorate (EG) · Region (SA) · Emirate (AE); "governorate" until a country is chosen. */
export const regionKind = (country: unknown) =>
  isCompanyCountry(country) ? COMPANY_COUNTRY_RULES[country].regionLabel : 'governorate';

/** Country whose legal-number copy is shown (Egypt until a country is chosen). */
export const legalCopyCountry = (country: unknown): CompanyCountry =>
  isCompanyCountry(country) ? country : 'EG';

/** i18n key of a document name: the CR and tax documents are named per country. */
export function documentLabelKey(type: DocumentType, country: unknown) {
  const legal = type === 'commercial_register' || type === 'tax_card';
  return legal && (country === 'SA' || country === 'AE')
    ? (`options.legalDocument.${country}.${type}` as const)
    : (`options.document.${type}` as const);
}
