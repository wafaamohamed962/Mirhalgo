import { useTranslation } from 'react-i18next';
import type { OrderStatus, TicketStatus } from '@mirhalgo/shared';
import { cn } from '../../../lib/utils';

export type StatusTone = 'blue' | 'violet' | 'success' | 'warning' | 'error' | 'muted';

const DOT: Record<StatusTone, string> = {
  blue: 'bg-blue-600',
  violet: 'bg-violet-600',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  muted: 'bg-slate-200',
};

const ORDER_TONES: Record<OrderStatus, StatusTone> = {
  under_review: 'muted',
  awaiting_offers: 'warning',
  offers_received: 'violet',
  awaiting_approval: 'blue',
  in_progress: 'blue',
  completed: 'success',
  cancelled: 'muted',
  rejected: 'error',
};

const TICKET_TONES: Record<TicketStatus, StatusTone> = {
  open: 'warning',
  in_progress: 'blue',
  resolved: 'success',
};

/** Neutral pill + colored dot: the text stays heading-colored, so contrast passes AA. Also used
 * by the company portal (MW_004). */
export function StatusPill({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-caption font-semibold whitespace-nowrap text-heading">
      <span aria-hidden="true" className={cn('size-2 rounded-full', DOT[tone])} />
      {label}
    </span>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  return <StatusPill tone={ORDER_TONES[status]} label={t(`portal.orderStatus.${status}`)} />;
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const { t } = useTranslation();
  return <StatusPill tone={TICKET_TONES[status]} label={t(`portal.support.status.${status}`)} />;
}
