import { useTranslation } from 'react-i18next';
import type { CompanyCard } from '@mirhalgo/shared';
import { flags } from '../../../lib/env';

/**
 * Company identity in the directory (spec B5 pending decision, MW_002 decision 18): one
 * switch, VITE_SHOW_COMPANY_IDENTITY. Off → "MirhalGo Partner" + a stable number, no logo.
 * Offers are always anonymous ("MirhalGo Partner #001").
 */
export function usePartnerName() {
  const { t, i18n } = useTranslation();
  return (partnerNumber: number) =>
    t('portal.partner', {
      number: partnerNumber.toLocaleString(i18n.language, {
        minimumIntegerDigits: 3,
        useGrouping: false,
      }),
    });
}

/** Same company → same partner number, whatever the sort order (1–999). */
const stableNumber = (id: string) =>
  ([...id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 997, 7) % 999) + 1;

/** Display name + logo of a directory company, honouring the identity flag. */
export function useCompanyIdentity() {
  const partnerName = usePartnerName();
  return (company: Pick<CompanyCard, 'id' | 'name' | 'logoUrl'>) =>
    flags.showCompanyIdentity
      ? { name: company.name, logoUrl: company.logoUrl }
      : { name: partnerName(stableNumber(company.id)), logoUrl: null };
}
