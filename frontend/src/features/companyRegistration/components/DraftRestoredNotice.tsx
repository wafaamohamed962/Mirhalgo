import { useTranslation } from 'react-i18next';
import { Info, X } from 'lucide-react';

/**
 * Subtle one-line notice shown after the autosaved draft was restored (CLAUDE.md decision 24):
 * replaces the spec's "Continue your application?" prompt. "Start over" clears the draft.
 */
export function DraftRestoredNotice({
  onStartOver,
  onDismiss,
}: {
  onStartOver: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div role="status" className="flex items-center gap-2 text-small text-muted">
      <Info aria-hidden="true" className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        {t('company.register.draft.restored')}{' '}
        <button
          type="button"
          onClick={onStartOver}
          className="inline-flex min-h-6 items-center font-semibold text-link underline-offset-2 hover:underline"
        >
          {t('company.register.draft.startOver')}
        </button>
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('company.register.draft.dismiss')}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-slate-50 hover:text-heading"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
