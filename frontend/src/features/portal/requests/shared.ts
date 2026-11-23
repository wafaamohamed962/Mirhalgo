import { useSearchParams } from 'react-router';
import { Globe, ShoppingBag, Truck, type LucideIcon } from 'lucide-react';
import type { ServiceType } from '@mirhalgo/shared';

export const SERVICE_ICONS: Record<ServiceType, LucideIcon> = {
  international: Globe,
  domestic: Truck,
  china: ShoppingBag,
};

/**
 * Sending a request to companies picked in the directory (MW_002 B3/B5). Off until the directory
 * is real (MW_003 plan §5 item 9): the companies are mocked, so their ids cannot be stored with a
 * real order. The code stays; turning this on brings back the checkboxes, the bulk bar, "Send to
 * all in category" and the "Sending to" bar.
 */
export const companySelection = { enabled: false };

/** `/app/new-request` with the picked companies (just the page while selection is off). */
export const newRequestFor = (ids: string[]) =>
  companySelection.enabled && ids.length
    ? `/app/new-request?companies=${ids.join(',')}`
    : '/app/new-request';

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
