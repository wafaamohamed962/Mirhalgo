import { useTranslation } from 'react-i18next';

export type MoneyFormat = 'locale' | 'plain';

/**
 * One money formatter for the whole site, in the current language.
 * - `locale` (default, customer portal): "38,500 EGP" / "٣٨٬٥٠٠ ج.م.".
 * - `plain` (company portal, MW_004 spec B5): Western digits + the currency's name,
 *   "1,000 دولار" / "1,000 USD", up to 2 decimals. Whether the whole site should use it is
 *   pending with the Team Lead: switching means changing the default here only.
 */
export function useMoney({ format = 'locale' }: { format?: MoneyFormat } = {}) {
  const { t, i18n } = useTranslation();
  return (value: number, currency = 'EGP') =>
    format === 'plain'
      ? `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)} ${t(`money.${currency}`)}`
      : new Intl.NumberFormat(i18n.language, {
          style: 'currency',
          currency,
          maximumFractionDigits: 0,
        }).format(value);
}
