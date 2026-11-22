import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bell, MessageCircle, Package, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';
import type { AppNotification, NotificationEvent } from '@mirhalgo/shared';
import { useDateFormat } from '../../../lib/dateFormat';
import { cn } from '../../../lib/utils';
import { portalApi } from '../../../services/api/portal';
import { keys } from '../../../services/api/queries';

const ICONS: Record<NotificationEvent, LucideIcon> = {
  new_offer: Package,
  order_status: Bell,
  question_reply: MessageCircle,
  security: ShieldCheck,
  news: Sparkles,
};

/** One notification: links to its order/page and marks itself read when opened (spec B7). */
export function NotificationItem({
  item,
  compact = false,
  onOpen,
}: {
  item: AppNotification;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const { t } = useTranslation();
  const { formatDate } = useDateFormat();
  const queryClient = useQueryClient();
  const Icon = ICONS[item.event];

  const open = () => {
    onOpen?.();
    if (item.read) return;
    queryClient.setQueryData<AppNotification[]>(keys.notifications, (list) =>
      list?.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
    );
    void portalApi.markNotificationRead(item.id).catch(() => {
      void queryClient.invalidateQueries({ queryKey: keys.notifications });
    });
  };

  return (
    <Link
      to={item.link}
      onClick={open}
      className={cn(
        'flex items-start gap-3 rounded-sm p-3 text-start no-underline transition-colors duration-150 ease-out hover:bg-slate-50',
        !item.read && 'bg-blue-50',
        !compact && 'border border-slate-200',
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('text-small text-heading', !item.read && 'font-semibold')}>
          {t(`portal.notifications.text.${item.event}`, item.params)}
        </span>
        <span className="text-caption text-muted">{formatDate(item.createdAt, true)}</span>
      </span>
      {!item.read && (
        <>
          <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-blue-600" />
          <span className="sr-only">{t('portal.notifications.unread')}</span>
        </>
      )}
    </Link>
  );
}
