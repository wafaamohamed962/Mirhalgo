import type { OfferTotal } from '@mirhalgo/shared';
import { useMoney } from '../../lib/money';

/** "1,000 دولار + 38,000 جنيه" / "5,200 جنيه" (spec B5), with the shared money formatter. */
export function useOfferTotal() {
  const money = useMoney({ format: 'plain' });
  return (total: OfferTotal) =>
    [
      total.foreign && money(total.foreign.amount, total.foreign.currency),
      total.egp !== undefined && money(total.egp, 'EGP'),
    ]
      .filter(Boolean)
      .join(' + ');
}
