import { useTranslation } from 'react-i18next';
import { BellOff } from 'lucide-react';
import {
  BackButton,
  Button,
  EmptyState,
  QueryState,
  Tabs,
  tabPanelProps,
} from '../../../components/ui';
import { useQueryParam } from '../../../lib/useUrlState';
import { useNotifications } from '../../../services/api/queries';
import { NotificationItem } from './NotificationItem';
import { useMarkAllRead } from './useMarkAllRead';

const FILTERS = ['all', 'unread'] as const;

/** /app/notifications (spec B7): All / Unread, each item opens its order or page. */
export default function NotificationsPage() {
  const { t } = useTranslation();
  // in the URL: Back from an order opened here restores the filter
  const [filter, setFilter] = useQueryParam('filter', 'all', FILTERS);
  const notifications = useNotifications();
  const markAll = useMarkAllRead();
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <BackButton />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs
          id="notifications"
          label={t('portal.notifications.filter')}
          value={filter}
          onChange={setFilter}
          items={[
            {
              value: 'all',
              label: t('portal.notifications.all'),
              count: notifications.data?.length,
            },
            { value: 'unread', label: t('portal.notifications.unreadTab'), count: unread },
          ]}
        />
        <Button
          variant="secondary"
          shape="form"
          disabled={unread === 0}
          loading={markAll.isPending}
          onClick={() => markAll.mutate(undefined)}
        >
          {t('portal.notifications.markAll')}
        </Button>
      </div>
      <div {...tabPanelProps('notifications', filter)}>
        <QueryState
          query={notifications}
          isEmpty={(list) => !list.some((n) => filter === 'all' || !n.read)}
          empty={<EmptyState icon={BellOff} title={t('portal.notifications.empty')} />}
        >
          {(list) => (
            <ul className="flex flex-col gap-2">
              {list
                .filter((n) => filter === 'all' || !n.read)
                .map((item) => (
                  <li key={item.id}>
                    <NotificationItem item={item} />
                  </li>
                ))}
            </ul>
          )}
        </QueryState>
      </div>
    </div>
  );
}
