import { useSearchParams } from 'react-router';
import { Globe, ShoppingBag, Truck, type LucideIcon } from 'lucide-react';
import type { ServiceType } from '@mirhalgo/shared';

export const SERVICE_ICONS: Record<ServiceType, LucideIcon> = {
  international: Globe,
  domestic: Truck,
  china: ShoppingBag,
};

/** Companies picked in the directory travel as `?companies=id1,id2` (spec B3). */
export function useSelectedCompanies() {
  const [params, setParams] = useSearchParams();
  const ids = (params.get('companies') ?? '').split(',').filter(Boolean);
  const remove = (id: string) => {
    const next = ids.filter((value) => value !== id);
    setParams(next.length ? { companies: next.join(',') } : {}, { replace: true });
  };
  return { ids, remove };
}
