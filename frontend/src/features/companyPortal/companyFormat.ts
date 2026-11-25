import type { OfferTotal } from '@mirhalgo/shared';
import { useMoney } from '../../lib/money';

/*
 * Numbers in the company portal follow the spec's money format (B5): Western digits in both
 * languages ("1,000"), so KPIs, counts and totals read the same way.
 */

const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/** "1,234" / "12.5": a count or a measure, Western digits (null → "—"). */
export const formatNumber = (value: number | null) => (value === null ? '—' : plain.format(value));

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
