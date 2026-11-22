import { useTranslation } from 'react-i18next';
import type { OrderStatus, TicketStatus } from '@mirhalgo/shared';
import { cn } from '../../../lib/utils';

type Tone = 'blue' | 'violet' | 'success' | 'warning' | 'error' | 'muted';

const DOT: Record<Tone, string> = {
  blue: 'bg-blue-600',
  violet: 'bg-violet-600',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  muted: 'bg-slate-200',
};

const ORDER_TONES: Record<OrderStatus, Tone> = {
  awaiting_offers: 'warning',
  offers_received: 'violet',
  awaiting_approval: 'blue',
  in_progress: 'blue',
  completed: 'success',
  cancelled: 'muted',
  rejected: 'error',
};

const TICKET_TONES: Record<TicketStatus, Tone> = {
  open: 'warning',
  in_progress: 'blue',
  resolved: 'success',
};

/** Neutral pill + colored dot: the text stays heading-colored, so contrast passes AA. */
function Pill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-caption font-semibold whitespace-nowrap text-heading">
      <span aria-hidden="true" className={cn('size-2 rounded-full', DOT[tone])} />
      {label}
    </span>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  return <Pill tone={ORDER_TONES[status]} label={t(`portal.orderStatus.${status}`)} />;
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const { t } = useTranslation();
  return <Pill tone={TICKET_TONES[status]} label={t(`portal.support.status.${status}`)} />;
}
