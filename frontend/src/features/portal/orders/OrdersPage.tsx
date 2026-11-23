import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Package, Search } from 'lucide-react';
import { ORDER_TABS, type OrderSummary, type OrderTab } from '@mirhalgo/shared';
import {
  Button,
  EmptyState,
  QueryState,
  Select,
  Tabs,
  buttonClasses,
  tabPanelProps,
} from '../../../components/ui';
import { useDateFormat } from '../../../lib/dateFormat';
import { useQueryParam, useQuerySearch } from '../../../lib/useUrlState';
import { useOrders } from '../../../services/api/queries';
import { OrderStatusBadge } from '../components/StatusBadge';

function OrderCard({ order }: { order: OrderSummary }) {
  const { t, i18n } = useTranslation();
  const { formatDate } = useDateFormat();
  const hasOffers = order.offersCount > 0;

  return (
    <article className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-md sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 dir="ltr" className="font-mono font-semibold text-heading">
            {order.reference}
          </h3>
          <OrderStatusBadge status={order.status} />
          {order.newOffers > 0 && (
            <span className="rounded-full bg-violet-600 px-2 text-caption font-semibold text-white">
              {t('portal.orders.newOffers', { count: order.newOffers })}
            </span>
          )}
        </div>
        <p className="text-small text-body">{t(`portal.services.${order.service}.title`)}</p>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-caption text-muted">
          <div className="flex gap-1">
            <dt>{t('portal.orders.created')}</dt>
            <dd className="text-heading">{formatDate(order.createdAt)}</dd>
          </div>
          <div className="flex gap-1">
            <dt>{t('portal.orders.offers')}</dt>
            <dd className="text-heading">{order.offersCount.toLocaleString(i18n.language)}</dd>
          </div>
          <div className="flex gap-1">
            <dt>{t('portal.orders.updated')}</dt>
            <dd className="text-heading">{formatDate(order.updatedAt, true)}</dd>
          </div>
        </dl>
      </div>
      <Link
        to={`/app/orders/${order.id}${hasOffers ? '?tab=offers' : ''}`}
        aria-label={t(hasOffers ? 'portal.orders.viewOffersOf' : 'portal.orders.detailsOf', {
          reference: order.reference,
        })}
        className={buttonClasses({ variant: hasOffers ? 'primary' : 'secondary', shape: 'form' })}
      >
        {t(hasOffers ? 'portal.orders.viewOffers' : 'portal.orders.details')}
      </Link>
    </article>
  );
}

const ORDER_SORTS = ['newest', 'oldest'] as const;

/** /app/orders (spec B4): status tabs with counts, search, sort, load more. */
export default function OrdersPage() {
  const { t } = useTranslation();
  // tab, sort and search live in the URL: Back from an order restores the list exactly
  const [tab, setTab] = useQueryParam<OrderTab>('tab', 'all', ORDER_TABS);
  const [sort, setSort] = useQueryParam('sort', 'newest', ORDER_SORTS);
  const { input: searchInput, setInput: setSearchInput, search } = useQuerySearch('search');

  const orders = useOrders({ tab, search, sort });
  const counts = orders.data?.pages[0]?.counts;
  const items = orders.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <label
            htmlFor="orders-search"
            className="mb-1.5 block text-small font-semibold text-heading"
          >
            {t('portal.orders.search')}
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 bottom-3 size-5 text-muted"
          />
          <input
            id="orders-search"
            type="search"
            dir="ltr"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="MG-R-2026-000118"
            className="h-(--btn-height) w-full rounded-sm border border-slate-200 bg-white ps-10 pe-4 text-heading shadow-sm placeholder:text-muted focus:border-blue-600 focus:bg-blue-50"
          />
        </div>
        <div className="sm:w-48">
          <Select
            label={t('portal.orders.sort')}
            value={sort}
            onChange={(event) => setSort(event.target.value as (typeof ORDER_SORTS)[number])}
            options={[
              { value: 'newest', label: t('portal.orders.newest') },
              { value: 'oldest', label: t('portal.orders.oldest') },
            ]}
          />
        </div>
      </div>

      <Tabs
        id="orders"
        label={t('portal.orders.tabsLabel')}
        value={tab}
        onChange={(value) => setTab(value as OrderTab)}
        items={ORDER_TABS.map((value) => ({
          value,
          label: t(`portal.orders.tabs.${value}`),
          count: counts?.[value],
        }))}
      />

      <div {...tabPanelProps('orders', tab)} className="flex flex-col gap-4">
        <QueryState
          query={{ ...orders, data: orders.data }}
          isEmpty={() => items.length === 0}
          empty={
            <EmptyState
              icon={Package}
              title={t(search ? 'portal.orders.noResults' : 'portal.orders.empty')}
              text={
                search ? t('portal.orders.noResultsText', { search }) : t('portal.orders.emptyText')
              }
              action={
                !search && (
                  <Link to="/app/new-request" className={buttonClasses({ shape: 'form' })}>
                    {t('portal.nav.newRequest')}
                  </Link>
                )
              }
            />
          }
        >
          {(data) => (
            <>
              <p aria-live="polite" className="text-small text-muted">
                {t('portal.orders.resultCount', { count: data.pages[0]?.total ?? 0 })}
              </p>
              <ul className="flex flex-col gap-4">
                {items.map((order) => (
                  <li key={order.id}>
                    <OrderCard order={order} />
                  </li>
                ))}
              </ul>
              {orders.hasNextPage && (
                <Button
                  variant="secondary"
                  shape="form"
                  className="self-center"
                  loading={orders.isFetchingNextPage}
                  onClick={() => void orders.fetchNextPage()}
                >
                  {t('portal.orders.loadMore')}
                </Button>
              )}
            </>
          )}
        </QueryState>
      </div>
    </div>
  );
}
