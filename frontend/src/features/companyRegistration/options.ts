import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, MoreHorizontal, ShoppingBag, Truck, type LucideIcon } from 'lucide-react';
import {
  CHINA_SERVICES,
  CHINA_SITES,
  COMPANY_ACTIVITIES,
  COUNTRIES,
  GOVERNORATES,
  INTERNATIONAL_MODES,
  INTERNATIONAL_SCOPES,
  SERVICE_REGIONS,
  VEHICLE_TYPES,
  type CompanyActivity,
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
  governorates: ['governorate', GOVERNORATES],
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
      countries: COUNTRIES.filter((c) => c.iso !== 'EG').map((c) => ({
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
