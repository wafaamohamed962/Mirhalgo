import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

/**
 * Inactive link placeholder (Instagram, Privacy Policy, Terms): `aria-disabled`,
 * focusable, and shows a "Coming soon" tooltip on hover and keyboard focus.
 */
export function ComingSoon({
  label,
  className,
  children,
}: {
  /** Accessible name, e.g. "Instagram". */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const soon = t('contact.comingSoon');

  return (
    <span
      role="link"
      aria-disabled="true"
      aria-label={`${label} (${soon})`}
      tabIndex={0}
      className={cn('group relative inline-flex cursor-not-allowed', className)}
    >
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute start-1/2 bottom-full z-20 mb-2 -translate-x-1/2 rounded-sm bg-navy-900 px-2 py-1 text-caption whitespace-nowrap text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 rtl:translate-x-1/2"
      >
        {soon}
      </span>
    </span>
  );
}
