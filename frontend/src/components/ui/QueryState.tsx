import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Inbox, type LucideIcon } from 'lucide-react';
import { errorKey } from '../../lib/apiClient';
import { Button } from './Button';
import { SkeletonList } from './Skeleton';

/** Empty result with an icon, a message and an optional action. */
export function EmptyState({
  title,
  text,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  text?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Icon aria-hidden="true" className="size-7" />
      </span>
      <p className="text-h3">{title}</p>
      {text && <p className="max-w-md text-small text-body">{text}</p>}
      {action}
    </div>
  );
}

/** Failed request with a retry button. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-error bg-white px-6 py-10 text-center"
    >
      <CircleAlert aria-hidden="true" className="size-8 text-error" />
      <p className="text-body">{t(errorKey(error))}</p>
      {onRetry && (
        <Button variant="secondary" shape="form" onClick={onRetry}>
          {t('ui.retry')}
        </Button>
      )}
    </div>
  );
}

type QueryLike<T> = {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
};

/**
 * Loading (skeletons) / error (retry) / empty / content for one query, so every page
 * handles the three states the same way (spec B1).
 */
export function QueryState<T>({
  query,
  isEmpty,
  empty,
  skeleton = <SkeletonList />,
  children,
}: {
  query: QueryLike<T>;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const { t } = useTranslation();
  if (query.isPending) {
    return (
      <div aria-busy="true">
        <span className="sr-only">{t('ui.loading')}</span>
        {skeleton}
      </div>
    );
  }
  if (query.isError || query.data === undefined) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (isEmpty?.(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
