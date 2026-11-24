import { useTranslation } from 'react-i18next';
import type { LocalizedName } from '@mirhalgo/shared';
import { localizedName, useReference } from '../../services/api/reference';

/** Names of every reference list the summary may show (all cached). */
export function useReferenceNames() {
  const { i18n } = useTranslation();
  const data = [
    ['countries', useReference('countries').data],
    ['regions', useReference('regions').data],
    ['cities', useReference('cities').data],
    ['ports', useReference('ports').data],
    ['airports', useReference('airports').data],
    ['container-types', useReference('container-types').data],
    ['truck-types', useReference('truck-types').data],
    ['shipping-lines', useReference('shipping-lines').data],
  ] as const;
  const maps = new Map(
    data.map(([list, items]) => [
      list as string,
      new Map(
        ((items ?? []) as Array<{ id?: string; code?: string; name: LocalizedName }>).map(
          (item) => [item.id ?? item.code!, item.name],
        ),
      ),
    ]),
  );
  return (list: string, id: string) => {
    const name = maps.get(list)?.get(id);
    return name && localizedName(name, i18n.language);
  };
}
