import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { cn } from '../../lib/utils';

/** AR / EN toggle (spec 3.1). The i18n module updates <html lang dir> and localStorage. */
export function LanguageSwitch({ onDark = false }: { onDark?: boolean }) {
  const { t, i18n } = useTranslation();
  const target = t('lang.toggleLang');

  return (
    <button
      type="button"
      onClick={() => void i18n.changeLanguage(target)}
      aria-label={t('lang.toggleLabel')}
      lang={target}
      className={cn(
        'inline-flex h-(--btn-height) items-center gap-1.5 rounded-full px-3 text-small font-semibold transition-colors duration-200 ease-out',
        onDark ? 'text-white hover:bg-white/10' : 'text-heading hover:bg-blue-50',
      )}
    >
      <Languages aria-hidden="true" className="size-5" />
      {t('lang.toggle')}
    </button>
  );
}
