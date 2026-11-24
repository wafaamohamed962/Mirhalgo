import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronDown, SearchX, Send } from 'lucide-react';
import {
  COMPANY_OFFER_STATUSES,
  type CompanyOffer,
  type CompanyOfferStatus,
  type CompanyRequest,
} from '@mirhalgo/shared';
import { Alert, Button, EmptyState, QueryState, Tabs } from '../../../components/ui';
import { tabPanelProps } from '../../../components/ui/tabPanel';
import { useDateFormat } from '../../../lib/dateFormat';
import { normalizeSearch } from '../../../lib/search';
import { useQueryParam, useQuerySearch } from '../../../lib/useUrlState';
import { cn } from '../../../lib/utils';
import {
  useCompanyAccount,
  useCompanyOffers,
  useCompanyRequests,
} from '../../../services/api/companyQueries';
import { CategoryChip, CategoryIcon } from '../categories';
import { formatNumber, useOfferTotal } from '../companyFormat';
import { ComparisonModal } from '../components/ComparisonModal';
import { CompanyPageHeader, NewBadge } from '../components/common';
import { OrderDetailsModal } from '../components/OrderDetailsModal';
import { SearchBox } from '../components/SearchBox';
import { OfferStatusBadge } from '../components/StatusBadges';
import { OfferModal } from '../offers/OfferModal';
import { useOfferRows } from '../offers/useOfferRows';
import { useSeen } from '../seen';
import { useUrlModals } from '../urlModal';

/*
 * Our submitted offers (MW_004 spec B6): stats, a status filter and a search (both in the URL),
 * offers grouped by order (groups sorted by their latest offer). A card opens to show its
 * template fields (and loses "New"); Edit while under review, Compare when the order has more
 * than one offer. Modals in the URL: ?edit=, ?compare=, ?order=.
 */

const FILTERS = ['all', ...COMPANY_OFFER_STATUSES] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_STRIPE: Record<CompanyOfferStatus, string> = {
  under_review: 'border-s-blue-600',
  accepted: 'border-s-success',
  rejected: 'border-s-error',
};

type Group = { orderId: string; offers: CompanyOffer[]; latest: string };

function groupByOrder(offers: CompanyOffer[]): Group[] {
  const groups = new Map<string, CompanyOffer[]>();
  for (const offer of offers)
    groups.set(offer.orderId, [...(groups.get(offer.orderId) ?? []), offer]);
  return [...groups]
    .map(([orderId, list]) => {
      const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { orderId, offers: sorted, latest: sorted[0]!.createdAt };
    })
    .sort((a, b) => b.latest.localeCompare(a.latest));
}

function OfferCard({
  offer,
  canCompare,
  onEdit,
  onCompare,
}: {
  offer: CompanyOffer;
  canCompare: boolean;
  onEdit: () => void;
  onCompare: () => void;
}) {
  const { t } = useTranslation();
  const { formatDate } = useDateFormat();
  const total = useOfferTotal();
  const rows = useOfferRows();
  const { isNew, markSeen } = useSeen();
  const [open, setOpen] = useState(false);
  const panelId = `offer-${offer.id}-details`;
  const toggle = () => {
    setOpen((value) => !value);
    markSeen('offer', offer.id, offer.status); // opening a card removes "New" (spec B6)
  };
  const details = rows(offer);

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-s-4 border-slate-200 bg-white p-4',
        STATUS_STRIPE[offer.status],
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span dir="ltr" className="font-semibold whitespace-nowrap text-heading">
          {offer.id}
        </span>
        {isNew('offer', offer.id, offer.status) && <NewBadge />}
        <OfferStatusBadge status={offer.status} />
        <span className="ms-auto text-caption text-muted">{formatDate(offer.createdAt)}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-small">
        <span className="text-muted">{t(`companyPortal.templates.${offer.template}`)}</span>
        <span dir="auto" className="font-semibold text-heading">
          {total(offer.total)}
        </span>
      </div>
      {offer.status === 'rejected' && offer.rejectionReason && (
        <p className="rounded-sm bg-red-50 p-3 text-small text-red-700">
          <span className="font-semibold">{t('companyPortal.offers.rejectionReason')}: </span>
          {offer.rejectionReason}
        </p>
      )}
      {open && (
        <div id={panelId}>
          {details.length ? (
            <dl className="grid gap-x-6 gap-y-2 rounded-sm bg-slate-50 p-3 sm:grid-cols-2">
              {details.map((row) => (
                <div key={row.label} className="flex min-w-0 flex-col">
                  <dt className="text-caption text-muted">{row.label}</dt>
                  <dd dir="auto" className="text-small break-words text-heading">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-small text-muted">{t('companyPortal.offers.noDetails')}</p>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          shape="form"
          className="h-11"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
        >
          <ChevronDown
            aria-hidden="true"
            className={cn('size-4 transition-transform', open && 'rotate-180')}
          />
          {open ? t('companyPortal.offers.hideDetails') : t('companyPortal.offers.showDetails')}
        </Button>
        {offer.status === 'under_review' && (
          <Button
            variant="secondary"
            shape="form"
            className="h-11 px-4 text-small"
            onClick={onEdit}
          >
            {t('companyPortal.offers.edit')}
          </Button>
        )}
        {canCompare && (
          <Button
            variant="secondary"
            shape="form"
            className="h-11 px-4 text-small"
            onClick={onCompare}
          >
            {t('companyPortal.offers.compare')}
          </Button>
        )}
      </div>
    </li>
  );
}

function Stats({ offers }: { offers: CompanyOffer[] }) {
  const { t } = useTranslation();
  const count = (status?: CompanyOfferStatus) =>
    formatNumber(status ? offers.filter((o) => o.status === status).length : offers.length);
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {(['all', ...COMPANY_OFFER_STATUSES] as const).map((key) => (
        <div key={key} className="rounded-lg border border-slate-200 bg-white p-3">
          <dt className="text-caption text-muted">{t(`companyPortal.offers.stats.${key}`)}</dt>
          <dd dir="ltr" className="text-h3 text-heading rtl:text-end">
            {count(key === 'all' ? undefined : key)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function OffersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const offers = useCompanyOffers();
  const requests = useCompanyRequests();
  const suspended = useCompanyAccount().data?.offerSubmission === 'suspended';
  const [filter, setFilter] = useQueryParam<Filter>('status', 'all', FILTERS);
  const { input, setInput, search } = useQuerySearch('search');
  const { params, open, close } = useUrlModals();
  const editId = params.get('edit');
  const compareId = params.get('compare');
  const detailsId = params.get('order');

  const offersOnOrder = (orderId: string, ours: number) =>
    requests.data?.find((r: CompanyRequest) => r.id === orderId)?.offersCount ?? ours;
  const query = normalizeSearch(search);
  // only an offer under review can be edited (spec B5); an old link says why instead
  const editing = offers.data?.find(
    (offer) => offer.id === editId && offer.status === 'under_review',
  );
  const editBlocked = Boolean(editId && offers.data && !editing);

  return (
    <>
      <CompanyPageHeader
        title={t('companyPortal.nav.offers')}
        note={t('companyPortal.offers.note')}
      />
      {editBlocked && (
        <div className="mb-5">
          <Alert tone="info">{t('errors.OFFER_NOT_EDITABLE')}</Alert>
        </div>
      )}
      <QueryState
        query={offers}
        isEmpty={(data) => data.length === 0}
        empty={<EmptyState icon={Send} title={t('companyPortal.offers.empty')} />}
      >
        {(data) => {
          const shown = data.filter(
            (offer) =>
              (filter === 'all' || offer.status === filter) &&
              (!query ||
                normalizeSearch(offer.id).includes(query) ||
                normalizeSearch(offer.orderId).includes(query)),
          );
          const groups = groupByOrder(shown);
          return (
            <div className="flex flex-col gap-5">
              <Stats offers={data} />
              <SearchBox
                id="offers-search"
                label={t('companyPortal.offers.search')}
                placeholder={t('companyPortal.offers.searchPlaceholder')}
                value={input}
                onChange={setInput}
              />
              <Tabs
                id="offers"
                label={t('companyPortal.offers.filterLabel')}
                value={filter}
                onChange={(value) => setFilter(value as Filter)}
                items={FILTERS.map((value) => ({
                  value,
                  label: t(`companyPortal.offers.stats.${value}`),
                  count:
                    value === 'all' ? data.length : data.filter((o) => o.status === value).length,
                }))}
              />
              <div {...tabPanelProps('offers', filter)} className="flex flex-col gap-5">
                {groups.length === 0 ? (
                  <EmptyState icon={SearchX} title={t('companyPortal.offers.noResults')} />
                ) : (
                  groups.map((group) => {
                    const first = group.offers[0]!;
                    const total = offersOnOrder(group.orderId, group.offers.length);
                    return (
                      <section
                        key={group.orderId}
                        aria-label={t('companyPortal.offers.groupLabel', { id: group.orderId })}
                        className="flex flex-col gap-3"
                      >
                        <header className="flex flex-wrap items-center gap-3">
                          <CategoryIcon category={first.category} />
                          <h2 dir="ltr" className="text-h3 whitespace-nowrap">
                            {group.orderId}
                          </h2>
                          <CategoryChip category={first.category} />
                          <span className="text-small text-muted">
                            {t('companyPortal.offers.ourCount', { count: group.offers.length })}
                          </span>
                          <Button
                            variant="ghost"
                            shape="form"
                            className="ms-auto h-11"
                            onClick={() => open({ order: group.orderId })}
                          >
                            {t('companyPortal.offers.orderDetails')}
                          </Button>
                        </header>
                        <ul className="flex flex-col gap-3">
                          {group.offers.map((offer) => (
                            <OfferCard
                              key={offer.id}
                              offer={offer}
                              canCompare={total > 1}
                              onEdit={() => open({ edit: offer.id })}
                              onCompare={() => open({ compare: offer.orderId })}
                            />
                          ))}
                        </ul>
                      </section>
                    );
                  })
                )}
              </div>
            </div>
          );
        }}
      </QueryState>

      {editing && (
        <OfferModal
          orderId={editing.orderId}
          template={editing.template}
          offer={editing}
          suspended={suspended}
          onClose={() => close(['edit'])}
        />
      )}
      {compareId && <ComparisonModal orderId={compareId} onClose={() => close(['compare'])} />}
      {detailsId && (
        <OrderDetailsModal
          orderId={detailsId}
          onClose={() => close(['order'])}
          onSubmitOffer={
            suspended
              ? undefined
              : () => void navigate(`/company/requests?order=${detailsId}&offer=new`)
          }
        />
      )}
    </>
  );
}
