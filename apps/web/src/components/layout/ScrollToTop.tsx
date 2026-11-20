import { useTranslation } from 'react-i18next';
import { ArrowUp } from 'lucide-react';
import { scrollToTop } from '../../lib/navigation';
import { useScrolledPast } from '../../lib/useScrolledPast';
import { cn } from '../../lib/utils';

const SHOW_AFTER_PX = 600;

/** Floating scroll-to-top button, appears after scrolling (spec 3.2). */
export function ScrollToTop() {
  const { t } = useTranslation();
  const visible = useScrolledPast(SHOW_AFTER_PX);

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label={t('ui.scrollToTop')}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={cn(
        'fixed end-4 bottom-4 z-30 flex size-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition duration-300 ease-out hover:bg-blue-700 sm:end-6 sm:bottom-6',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
      )}
    >
      <ArrowUp aria-hidden="true" className="size-5" />
    </button>
  );
}
