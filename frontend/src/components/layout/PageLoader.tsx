import { useTranslation } from 'react-i18next';
import { Spinner } from '../ui/Spinner';

/** Full-screen loader while a lazy route or the session loads. */
export function PageLoader() {
  const { t } = useTranslation();

  return (
    <div role="status" className="flex min-h-dvh items-center justify-center text-blue-600">
      <Spinner className="size-8" />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}
