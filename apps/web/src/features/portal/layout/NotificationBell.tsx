import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { Popover } from '../../../components/ui';
import { useNotifications } from '../../../services/api/queries';
import { NotificationItem } from '../notifications/NotificationItem';
import { useMarkAllRead } from '../notifications/useMarkAllRead';

const LATEST = 5;

/** Bell with the unread count and the latest 5 notifications (spec B7). */
export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const notifications = useNotifications();
  const markAll = useMarkAllRead();
  const items = notifications.data ?? [];
  const unread = items.filter((n) => !n.read).length;

  return (
    <Popover
      label={
        unread
          ? t('portal.notifications.bellUnread', { count: unread })
          : t('portal.notifications.bell')
      }
      trigger={
        <>
          <Bell aria-hidden="true" className="size-6" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute -end-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-error px-1 text-caption font-semibold text-white"
            >
              {unread.toLocaleString(i18n.language)}
            </span>
          )}
        </>
      }
    >
      {(close) => (
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <p className="font-semibold text-heading">{t('portal.nav.notifications')}</p>
            <button
              type="button"
              disabled={unread === 0 || markAll.isPending}
              onClick={() => markAll.mutate(undefined)}
              className="min-h-11 rounded-full px-3 text-small font-semibold text-link hover:bg-blue-50 disabled:opacity-50"
            >
              {t('portal.notifications.markAll')}
            </button>
          </div>
          {notifications.isPending && (
            <p className="p-3 text-small text-muted">{t('ui.loading')}</p>
          )}
          {notifications.isError && (
            <p className="p-3 text-small text-error">{t('portal.notifications.error')}</p>
          )}
          {notifications.data && items.length === 0 && (
            <p className="p-3 text-small text-muted">{t('portal.notifications.empty')}</p>
          )}
          <ul className="flex flex-col">
            {items.slice(0, LATEST).map((item) => (
              <li key={item.id}>
                <NotificationItem item={item} compact onOpen={close} />
              </li>
            ))}
          </ul>
          <Link
            to="/app/notifications"
            onClick={close}
            className="mt-1 rounded-sm px-3 py-2 text-center text-small font-semibold hover:bg-blue-50"
          >
            {t('portal.notifications.viewAll')}
          </Link>
        </div>
      )}
    </Popover>
  );
}
