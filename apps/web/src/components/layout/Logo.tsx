import { useTranslation } from 'react-i18next';
import markWhite from '../../assets/images/logo/mirhalgo-mark-white.svg';
import mark from '../../assets/images/logo/mirhalgo-mark.svg';
import { cn } from '../../lib/utils';

/**
 * Logo mark + the name "MirhalGo" (spec 3.1). `onDark` uses the white mark
 * (hero / navy navbar), otherwise the navy mark (light backgrounds).
 */
export function Logo({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  const { t } = useTranslation();

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <img src={onDark ? markWhite : mark} alt="" width={45} height={32} className="h-8 w-auto" />
      <span
        className={cn(
          'text-h3 leading-none font-extrabold',
          onDark ? 'text-white' : 'text-heading',
        )}
      >
        {t('common.brand')}
      </span>
    </span>
  );
}
