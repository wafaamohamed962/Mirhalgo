import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui';

/** Error text + "Try again" under a reference list (countries, regions) that could not load. */
export function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <p role="alert" className="flex flex-wrap items-center gap-2 text-small text-error">
      {t('company.register.fields.regionsError')}
      <Button variant="ghost" shape="form" onClick={onRetry}>
        {t('ui.retry')}
      </Button>
    </p>
  );
}
