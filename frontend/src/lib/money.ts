import { useTranslation } from 'react-i18next';

/** "38,500 EGP" / "٣٨٬٥٠٠ ج.م." in the current language. */
export function useMoney() {
  const { i18n } = useTranslation();
  return (value: number, currency = 'EGP') =>
    new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
}
