import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { CANCELLABLE_STATUSES, TIMELINE_STEPS, type OrderDetails } from '@mirhalgo/shared';
import {
  Alert,
  BackButton,
  Button,
  QueryState,
  Skeleton,
  Tabs,
  tabPanelProps,
} from '../../../components/ui';
import { useDateFormat } from '../../../lib/dateFormat';
import { cn } from '../../../lib/utils';
import { portalApi } from '../../../services/api/portal';
import { keys, useApiMutation, useOrder } from '../../../services/api/queries';
import { OrderStatusBadge } from '../components/StatusBadge';
import { OffersPanel } from './OffersPanel';
import { ReasonModal } from './OrderModals';

const TABS = ['details', 'offers', 'timeline'] as const;
type Tab = (typeof TABS)[number];

function DetailsPanel({ order }: { order: OrderDetails }) {
  const { t } = useTranslation();
  const { formatDate } = useDateFormat();
  const [cancelling, setCancelling] = useState(false);
  const cancel = useApiMutation((reason?: string) => portalApi.cancelOrder(order.id, reason), {
    setData: keys.order(order.id),
    invalidate: [keys.orders],
    success: 'portal.orders.cancelled',
    onSuccess: () => setCancelling(false),
  });

  const rows: Array<[string, string]> = [
    [t('portal.orders.reference'), order.reference],
    [t('portal.orders.service'), t(`portal.services.${order.service}.title`)],
    [t('portal.orders.created'), formatDate(order.createdAt, true)],
    [t('portal.orders.updated'), formatDate(order.updatedAt, true)],
    ...order.details.map(({ field, value }): [string, string] => [
      t(`portal.orderFields.${field}`),
      value,
    ]),
  ];

  return (
    <div className="flex flex-col gap-5">
      {order.status === 'cancelled' && (
        <Alert>
          {t('portal.orders.cancelledBanner')}
          {order.cancelReason && ` ${t('portal.orders.reasonWas', { reason: order.cancelReason })}`}
        </Alert>
      )}
      <dl className="grid gap-x-6 gap-y-4 rounded-lg bg-white p-5 shadow-md sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-caption text-muted">{label}</dt>
            <dd dir="auto" className="text-small font-semibold text-heading">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {CANCELLABLE_STATUSES.includes(order.status) && (
        <Button
          variant="danger"
          shape="form"
          className="self-start"
          onClick={() => setCancelling(true)}
        >
          {t('portal.orders.cancel')}
        </Button>
      )}
      {cancelling && (
        <ReasonModal
          title={t('portal.orders.cancelTitle')}
          description={t('portal.orders.cancelText')}
          confirmLabel={t('portal.orders.cancel')}
          busy={cancel.isPending}
          onConfirm={(reason) => cancel.mutate(reason)}
          onClose={() => setCancelling(false)}
        />
      )}
    </div>
  );
}

function TimelinePanel({ order }: { order: OrderDetails }) {
  const { t } = useTranslation();
  const { formatDate } = useDateFormat();
  const done = new Map(order.timeline.map((entry) => [entry.step, entry.at]));
  const closed = order.status === 'cancelled' || order.status === 'rejected';

  return (
    <ol className="flex flex-col rounded-lg bg-white p-5 shadow-md">
      {TIMELINE_STEPS.map((step, index) => {
        const at = done.get(step);
        return (
          <li key={step} className="relative flex gap-4 pb-6 last:pb-0">
            {index < TIMELINE_STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute start-4 top-9 h-[calc(100%-2.25rem)] w-0.5',
                  at ? 'bg-blue-600' : 'bg-slate-200',
                )}
              />
            )}
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full border-2',
                at
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-muted',
              )}
            >
              {at ? (
                <Check aria-hidden="true" className="size-4" />
              ) : (
                <span className="text-caption">{index + 1}</span>
              )}
            </span>
            <div className="pt-1.5">
              <p className={cn('text-small font-semibold', at ? 'text-heading' : 'text-muted')}>
                {t(`portal.timeline.${step}`)}
              </p>
              <p className="text-caption text-muted">
                {at ? formatDate(at, true) : t('portal.timeline.pending')}
              </p>
            </div>
          </li>
        );
      })}
      {closed && (
        <li className="mt-4 rounded-sm bg-slate-50 p-3 text-small text-body">
          {t(`portal.timeline.closed.${order.status}`)}
        </li>
      )}
    </ol>
  );
}

/** /app/orders/:id (spec B4): Details · Offers · Timeline. */
export default function OrderDetailsPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as Tab)
    : 'details';
  const order = useOrder(id);

  return (
    <div className="flex flex-col gap-5">
      <BackButton />
      <QueryState query={order} skeleton={<Skeleton className="h-96 rounded-lg" />}>
        {(data) => (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h2 dir="ltr" className="font-mono text-h2">
                {data.reference}
              </h2>
              <OrderStatusBadge status={data.status} />
            </div>
            <Tabs
              id="order"
              label={t('portal.orders.detailTabs')}
              value={tab}
              onChange={(value) =>
                setParams(value === 'details' ? {} : { tab: value }, { replace: true })
              }
              items={TABS.map((value) => ({
                value,
                label: t(`portal.orders.detailTab.${value}`),
                count: value === 'offers' ? data.offers.length : undefined,
              }))}
            />
            <div {...tabPanelProps('order', tab)}>
              {tab === 'details' && <DetailsPanel order={data} />}
              {tab === 'offers' && <OffersPanel order={data} />}
              {tab === 'timeline' && <TimelinePanel order={data} />}
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}
