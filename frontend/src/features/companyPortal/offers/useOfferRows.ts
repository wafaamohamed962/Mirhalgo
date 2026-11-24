import { useTranslation } from 'react-i18next';
import type { CompanyOffer } from '@mirhalgo/shared';
import { useDateFormat } from '../../../lib/dateFormat';
import { useMoney } from '../../../lib/money';
import { localizedName, useReference } from '../../../services/api/reference';
import { formatNumber } from '../companyFormat';
import { OFFER_FIELDS } from './offerFormModel';

export type OfferRow = { label: string; value: string };

/** The filled template fields of an offer, as readable rows (spec B6: an opened card). */
export function useOfferRows() {
  const { t, i18n } = useTranslation();
  const { formatDate } = useDateFormat();
  const money = useMoney({ format: 'plain' });
  const trucks = useReference('truck-types').data;

  return (offer: CompanyOffer): OfferRow[] => {
    const details = offer.details as Record<string, unknown>;
    return OFFER_FIELDS[offer.template].flatMap((field) => {
      const value = details[field.name];
      if (value === undefined || value === null || value === '') return [];
      const label = t(`companyPortal.offerForm.fields.${field.name}`);
      switch (field.kind) {
        case 'cost': {
          const line = value as { amount: number; currency: string };
          return [{ label, value: money(line.amount, line.currency) }];
        }
        case 'days':
          return [
            {
              label: `${label} (${t('companyPortal.offers.inDays')})`,
              value: formatNumber(Number(value)),
            },
          ];
        case 'date':
          return [{ label, value: formatDate(`${String(value)}T12:00:00Z`) }];
        case 'vehicle': {
          const truck = trucks?.find((item) => item.id === value);
          return [
            { label, value: truck ? localizedName(truck.name, i18n.language) : String(value) },
          ];
        }
        default:
          return [{ label, value: String(value) }];
      }
    });
  };
}
