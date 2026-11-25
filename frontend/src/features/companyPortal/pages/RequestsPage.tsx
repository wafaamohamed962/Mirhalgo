import { useTranslation } from 'react-i18next';
import { Inbox, SearchX } from 'lucide-react';
import type { CompanyRequest } from '@mirhalgo/shared';
import { Alert, Button, EmptyState, QueryState } from '../../../components/ui';
import { useDateFormat } from '../../../lib/dateFormat';
import { useQuerySearch } from '../../../lib/useUrlState';
import { cn } from '../../../lib/utils';
import { normalizeSearch } from '../../../lib/search';
import { useCompanyAccount, useCompanyRequests } from '../../../services/api/companyQueries';
import { CategoryChip, CategoryIcon } from '../categories';
import { categoryStripe } from '../categoryLook';
import { formatNumber } from '../companyFormat';
import { ComparisonModal } from '../components/ComparisonModal';
import { CompanyPageHeader, NewBadge } from '../components/common';
import { OrderDetailsModal } from '../components/OrderDetailsModal';
import { SearchBox } from '../components/SearchBox';
import { CompanyOrderStatusBadge } from '../components/StatusBadges';
import { OfferModalRoute } from '../offers/OfferModalRoute';
import { useSeen } from '../seen';
import { useUrlModals } from '../urlModal';

/*
 * Available requests (MW_004 spec B4): published orders assigned to this company, newest
 * first, searchable by order id or service. Details, the comparison and the offer form are
 * modals whose state is in the URL (?order=, ?compare=, ?offer=new).
 */

type Actions = {
  suspended: boolean;
  openDetails: (id: string) => void;
  openOffer: (id: string) => void;
  openCompare: (id: string) => void;
};

function OffersCount({
  request,
  openCompare,
}: { request: CompanyRequest } & Pick<Actions, 'openCompare'>) {
  const { t } = useTranslation();
  return (
    <span className="flex flex-col items-start gap-0.5">
      {request.offersCount > 0 ? (
        <button
          type="button"
          onClick={() => openCompare(request.id)}
          aria-label={t('companyPortal.requests.compareOffers', {
            count: request.offersCount,
            id: request.id,
          })}
          className="min-h-11 rounded-sm px-2 font-semibold text-link underline-offset-2 hover:underline"
        >
          {formatNumber(request.offersCount)}
        </button>
      ) : (
        <span className="px-2">{formatNumber(0)}</span>
      )}
      {request.ourOffersCount > 0 && (
        <span className="px-2 text-caption text-muted">
          {t('companyPortal.requests.youHave', { count: request.ourOffersCount })}
        </span>
      )}
    </span>
  );
}

function RowActions({
  request,
  suspended,
  openDetails,
  openOffer,
}: { request: CompanyRequest } & Omit<Actions, 'openCompare'>) {
  const { t } = useTranslation();
  const label =
    request.ourOffersCount > 0
      ? t('companyPortal.requests.submitAdditional')
      : t('companyPortal.submitOffer');
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        shape="form"
        className="h-11 px-4 text-small"
        onClick={() => openDetails(request.id)}
        aria-label={t('companyPortal.requests.detailsFor', { id: request.id })}
      >
        {t('companyPortal.requests.details')}
      </Button>
      {request.status === 'open' && (
        <Button
          shape="form"
          className="h-11 px-4 text-small"
          disabled={suspended}
          onClick={() => openOffer(request.id)}
          aria-label={`${label} — ${request.id}`}
        >
          {label}
        </Button>
      )}
    </div>
  );
}

function OrderId({ request }: { request: CompanyRequest }) {
  const { isNew } = useSeen();
  return (
    <span className="flex items-center gap-3">
      <CategoryIcon category={request.category} />
      <span dir="ltr" className="font-semibold whitespace-nowrap text-heading">
        {request.id}
      </span>
      {isNew('request', request.id) && <NewBadge />}
    </span>
  );
}

function RequestsTable({ requests, ...actions }: { requests: CompanyRequest[] } & Actions) {
  const { t } = useTranslation();
  const { formatDate } = useDateFormat();
  const columns = ['order', 'date', 'service', 'offers', 'status', 'actions'] as const;
  return (
    <>
      {/* tablet / desktop: the spec's table */}
      <div className="relative hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full min-w-3xl text-small">
          <thead className="bg-slate-50 text-muted">
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col" className="p-3 text-start font-semibold">
                  {t(`companyPortal.requests.columns.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr
                key={request.id}
                className={cn('border-t border-slate-200', categoryStripe(request.category))}
              >
                <th scope="row" className="p-3 text-start font-normal">
                  <OrderId request={request} />
                </th>
                <td className="p-3 whitespace-nowrap">{formatDate(request.createdAt)}</td>
                <td className="p-3">
                  <CategoryChip category={request.category} />
                </td>
                <td className="p-3">
                  <OffersCount request={request} openCompare={actions.openCompare} />
                </td>
                <td className="p-3">
                  <CompanyOrderStatusBadge status={request.status} />
                </td>
                <td className="p-3">
                  <RowActions request={request} {...actions} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* phones: one card per request, the same content */}
      <ul className="flex flex-col gap-3 md:hidden">
        {requests.map((request) => (
          <li
            key={request.id}
            className={cn(
              'flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4',
              categoryStripe(request.category),
            )}
          >
            <OrderId request={request} />
            <div className="flex flex-wrap items-center gap-2 text-caption text-muted">
              <CategoryChip category={request.category} />
              <CompanyOrderStatusBadge status={request.status} />
              <span>{formatDate(request.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-small">
              <span className="text-muted">{t('companyPortal.requests.columns.offers')}:</span>
              <OffersCount request={request} openCompare={actions.openCompare} />
            </div>
            <RowActions request={request} {...actions} />
          </li>
        ))}
      </ul>
    </>
  );
}

export default function RequestsPage() {
  const { t } = useTranslation();
  const requests = useCompanyRequests();
  const suspended = useCompanyAccount().data?.offerSubmission === 'suspended';
  const { input, setInput, search } = useQuerySearch('search');
  const { params, open, close } = useUrlModals();
  const orderId = params.get('order');
  const compareId = params.get('compare');
  const offerFor = params.get('offer') === 'new' ? orderId : null;

  // search by order id or service type (the category name in the current language)
  const query = normalizeSearch(search);
  const matches = (request: CompanyRequest) =>
    !query ||
    normalizeSearch(request.id).includes(query) ||
    normalizeSearch(t(`companyPortal.categories.${request.category}`)).includes(query);

  const actions: Actions = {
    suspended,
    openDetails: (id) => open({ order: id }),
    openOffer: (id) => open({ order: id, offer: 'new' }),
    openCompare: (id) => open({ compare: id }),
  };

  return (
    <>
      <CompanyPageHeader
        title={t('companyPortal.nav.requests')}
        note={t('companyPortal.requests.note')}
      />
      <div className="flex flex-col gap-5">
        {suspended && <Alert tone="info">{t('companyPortal.suspended')}</Alert>}
        <SearchBox
          id="requests-search"
          label={t('companyPortal.requests.search')}
          placeholder={t('companyPortal.requests.searchPlaceholder')}
          value={input}
          onChange={setInput}
        />
        <QueryState
          query={requests}
          isEmpty={(data) => data.length === 0}
          empty={<EmptyState icon={Inbox} title={t('companyPortal.requests.empty')} />}
        >
          {(data) => {
            const shown = data.filter(matches);
            return shown.length ? (
              <RequestsTable requests={shown} {...actions} />
            ) : (
              <EmptyState icon={SearchX} title={t('companyPortal.requests.noResults')} />
            );
          }}
        </QueryState>
      </div>

      {orderId && !offerFor && (
        <OrderDetailsModal
          orderId={orderId}
          onClose={() => close(['order'])}
          onSubmitOffer={suspended ? undefined : () => open({ offer: 'new' })}
        />
      )}
      {offerFor && <OfferModalRoute orderId={offerFor} onClose={() => close(['order', 'offer'])} />}
      {compareId && <ComparisonModal orderId={compareId} onClose={() => close(['compare'])} />}
    </>
  );
}
