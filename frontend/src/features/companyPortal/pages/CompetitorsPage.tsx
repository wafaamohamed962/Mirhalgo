import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import type { CompetitorRow } from '@mirhalgo/shared';
import { Button, EmptyState, QueryState } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { useCompetitors } from '../../../services/api/companyQueries';
import { CategoryChip, CategoryIcon } from '../categories';
import { categoryStripe } from '../categoryLook';
import { formatNumber, useOfferTotal } from '../companyFormat';
import { ComparisonModal } from '../components/ComparisonModal';
import { CompanyPageHeader } from '../components/common';
import { useUrlModals } from '../urlModal';

/*
 * Competitor offers (MW_004 spec B7): orders we are assigned to or offered on where at least
 * one other company offered. Competitors are never named (the API returns "#N" only) and
 * companies hiding their offers are only counted. Compare opens ?compare=<order>.
 */

function OurTotals({ row }: { row: CompetitorRow }) {
  const { t } = useTranslation();
  const total = useOfferTotal();
  if (row.ours.length === 0) {
    return <span className="text-muted">{t('companyPortal.competitors.noOffer')}</span>;
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {row.ours.map((offer) => (
        <li key={offer.id} dir="auto" className="font-semibold whitespace-nowrap text-heading">
          {total(offer.total)}
        </li>
      ))}
    </ul>
  );
}

export default function CompetitorsPage() {
  const { t } = useTranslation();
  const competitors = useCompetitors();
  const { params, open, close } = useUrlModals();
  const compareId = params.get('compare');
  const columns = ['order', 'service', 'ours', 'competitors', 'actions'] as const;
  const compare = (row: CompetitorRow) => (
    <Button
      variant="secondary"
      shape="form"
      className="h-11 px-4 text-small"
      onClick={() => open({ compare: row.orderId })}
      aria-label={t('companyPortal.competitors.compareFor', { id: row.orderId })}
    >
      {t('companyPortal.competitors.compare')}
    </Button>
  );
  const count = (row: CompetitorRow) => (
    <span className="flex flex-col">
      <span className="font-semibold text-heading">{formatNumber(row.visibleCount)}</span>
      {row.hiddenCount > 0 && (
        <span className="text-caption text-muted">
          {t('companyPortal.competitors.hidden', { count: row.hiddenCount })}
        </span>
      )}
    </span>
  );

  return (
    <>
      <CompanyPageHeader
        title={t('companyPortal.nav.competitors')}
        note={t('companyPortal.competitors.note')}
      />
      <QueryState
        query={competitors}
        isEmpty={(data) => data.length === 0}
        empty={<EmptyState icon={Building2} title={t('companyPortal.competitors.empty')} />}
      >
        {(rows) => (
          <>
            <div className="relative hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
              <table className="w-full min-w-2xl text-small">
                <thead className="bg-slate-50 text-muted">
                  <tr>
                    {columns.map((column) => (
                      <th key={column} scope="col" className="p-3 text-start font-semibold">
                        {t(`companyPortal.competitors.columns.${column}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.orderId}
                      className={cn('border-t border-slate-200', categoryStripe(row.category))}
                    >
                      <th scope="row" className="p-3 text-start font-normal">
                        <span className="flex items-center gap-3">
                          <CategoryIcon category={row.category} />
                          <span dir="ltr" className="font-semibold whitespace-nowrap text-heading">
                            {row.orderId}
                          </span>
                        </span>
                      </th>
                      <td className="p-3">
                        <CategoryChip category={row.category} />
                      </td>
                      <td className="p-3">
                        <OurTotals row={row} />
                      </td>
                      <td className="p-3">{count(row)}</td>
                      <td className="p-3">{compare(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="flex flex-col gap-3 md:hidden">
              {rows.map((row) => (
                <li
                  key={row.orderId}
                  className={cn(
                    'flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4',
                    categoryStripe(row.category),
                  )}
                >
                  <span className="flex items-center gap-3">
                    <CategoryIcon category={row.category} />
                    <span dir="ltr" className="font-semibold whitespace-nowrap text-heading">
                      {row.orderId}
                    </span>
                    <CategoryChip category={row.category} />
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-small">
                    <div>
                      <p className="text-caption text-muted">
                        {t('companyPortal.competitors.columns.ours')}
                      </p>
                      <OurTotals row={row} />
                    </div>
                    <div>
                      <p className="text-caption text-muted">
                        {t('companyPortal.competitors.columns.competitors')}
                      </p>
                      {count(row)}
                    </div>
                  </div>
                  {compare(row)}
                </li>
              ))}
            </ul>
          </>
        )}
      </QueryState>
      {compareId && <ComparisonModal orderId={compareId} onClose={() => close(['compare'])} />}
    </>
  );
}
