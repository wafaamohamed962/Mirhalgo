import { useTranslation } from 'react-i18next';
import type { CompetitorComparison } from '@mirhalgo/shared';
import { Modal, QueryState } from '../../../components/ui';
import { useDateFormat } from '../../../lib/dateFormat';
import { useComparison } from '../../../services/api/companyQueries';
import { useOfferTotal } from '../companyFormat';
import { OfferStatusBadge } from './StatusBadges';

type Row = {
  key: string;
  name: string;
  status: CompetitorComparison['ours'][number]['status'];
  template: CompetitorComparison['ours'][number]['template'];
  createdAt: string;
  total: CompetitorComparison['ours'][number]['total'];
};

function OffersTable({ caption, rows }: { caption: string; rows: Row[] }) {
  const { t } = useTranslation();
  const { formatDate } = useDateFormat();
  const total = useOfferTotal();
  return (
    <div className="relative overflow-x-auto rounded-sm border border-slate-200">
      <table className="w-full min-w-lg text-small">
        <caption className="bg-slate-50 p-3 text-start font-semibold text-heading">
          {caption}
        </caption>
        <thead className="text-muted">
          <tr>
            {(['offer', 'status', 'template', 'date', 'total'] as const).map((column) => (
              <th key={column} scope="col" className="p-3 text-start font-semibold">
                {t(`companyPortal.comparison.columns.${column}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-slate-200">
              <th
                scope="row"
                className="p-3 text-start font-semibold whitespace-nowrap text-heading"
              >
                {row.name}
              </th>
              <td className="p-3">
                <OfferStatusBadge status={row.status} />
              </td>
              <td className="p-3">{t(`companyPortal.templates.${row.template}`)}</td>
              <td className="p-3 whitespace-nowrap">{formatDate(row.createdAt)}</td>
              <td dir="auto" className="p-3 font-semibold whitespace-nowrap text-heading">
                {total(row.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Price comparison of one order (spec B4, B6, B7): our offers, then each visible competitor as
 * "Competitor company #N", then how many companies hide their offers. The API never returns a
 * competitor's name, id or alias (the mock handler removes them).
 */
export function ComparisonModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const comparison = useComparison(orderId);
  return (
    <Modal title={t('companyPortal.comparison.title', { id: orderId })} onClose={onClose} size="lg">
      <QueryState query={comparison}>
        {(data) => (
          <div className="flex flex-col gap-4">
            {data.ours.length > 0 ? (
              <OffersTable
                caption={t('companyPortal.comparison.ours')}
                rows={data.ours.map((offer) => ({ ...offer, key: offer.id, name: offer.id }))}
              />
            ) : (
              <p className="text-small text-muted">{t('companyPortal.comparison.noOurs')}</p>
            )}
            {data.competitors.length > 0 ? (
              <OffersTable
                caption={t('companyPortal.comparison.competitors')}
                rows={data.competitors.map((offer, i) => ({
                  ...offer,
                  key: `${offer.label}-${i}`,
                  name: t('companyPortal.comparison.competitor', { n: offer.label }),
                }))}
              />
            ) : (
              <p className="text-small text-muted">{t('companyPortal.comparison.noCompetitors')}</p>
            )}
            {data.hiddenCount > 0 && (
              <p className="text-small text-muted">
                {t('companyPortal.comparison.hidden', { count: data.hiddenCount })}
              </p>
            )}
          </div>
        )}
      </QueryState>
    </Modal>
  );
}
