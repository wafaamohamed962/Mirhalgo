import { useTranslation } from 'react-i18next';
import type { CountryScope, ReferenceList } from '@mirhalgo/shared';
import type { ChoiceOption } from '../../components/ui';
import type { ComboboxOption } from '../../components/ui/Combobox';
import { comboboxOptions, countryOptions, useReference } from '../../services/api/reference';

/** Translated choices of a fixed list: portal.request.options.<list>.<value>. */
export function useChoices() {
  const { t } = useTranslation();
  return <V extends string>(list: string, values: readonly V[]): ChoiceOption<V>[] =>
    values.map((value) => {
      const key: string = `portal.request.options.${list}.${value}`;
      return { value, label: t(key) };
    });
}

type Picker = { options: ComboboxOption[]; loading: boolean };

export function useCountryOptions(scope: CountryScope = 'all'): Picker {
  const { i18n } = useTranslation();
  const query = useReference('countries', { scope });
  return { options: countryOptions(query.data ?? [], i18n.language), loading: query.isPending };
}

/** Ports, airports, cities or regions of one country (idle until a country is chosen). */
export function usePlaceOptions(
  list: Extract<ReferenceList, 'ports' | 'airports' | 'cities' | 'regions'>,
  country: string | undefined,
): Picker {
  const { i18n } = useTranslation();
  const query = useReference(list, { country }, { enabled: Boolean(country) });
  const code =
    list === 'ports'
      ? (item: { unlocode?: string | null }) => item.unlocode
      : list === 'airports'
        ? (item: { id: string }) => item.id
        : undefined;
  return {
    options: comboboxOptions(query.data ?? [], i18n.language, {
      code: code as never,
      flags: list === 'ports' || list === 'airports',
    }),
    loading: Boolean(country) && query.isPending,
  };
}

/** Container types, truck types, shipping lines. */
export function useTypeOptions(
  list: Extract<ReferenceList, 'container-types' | 'truck-types' | 'shipping-lines'>,
): Picker {
  const { i18n } = useTranslation();
  const query = useReference(list);
  return {
    options: comboboxOptions(query.data ?? [], i18n.language, { flags: false }),
    loading: query.isPending,
  };
}
