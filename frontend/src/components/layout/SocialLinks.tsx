import { useTranslation } from 'react-i18next';
import { SOCIAL_LINKS } from '../../lib/navigation';
import { cn } from '../../lib/utils';
import { ComingSoon } from '../ui/ComingSoon';

/** Circular brand-colored social icons (contact section + footer, spec 3.5 / 3.6). */
export function SocialLinks({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <ul className={cn('flex items-center gap-3', className)}>
      {SOCIAL_LINKS.map(({ id, href, icon: Icon, brandClass }) => {
        const circle = cn(
          'flex size-11 items-center justify-center rounded-full text-white shadow-md',
          brandClass,
        );
        return (
          <li key={id}>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${t(`contact.${id}`)} ${t('ui.opensInNewTab')}`}
                className={cn(
                  circle,
                  'transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg',
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
              </a>
            ) : (
              <ComingSoon label={t(`contact.${id}`)} className="rounded-full">
                <span className={cn(circle, 'opacity-60')}>
                  <Icon aria-hidden="true" className="size-5" />
                </span>
              </ComingSoon>
            )}
          </li>
        );
      })}
    </ul>
  );
}
