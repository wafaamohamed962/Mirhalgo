import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Container } from './Container';
import { LanguageSwitch } from './LanguageSwitch';
import { Logo } from './Logo';

/**
 * Light layout for auth pages, the dashboard placeholder and 404: logo + language switch.
 * `backHome` adds a visible "Back to home" link (sign-up forms, MW_003 A3); leaving a form
 * with data is confirmed by the page's unsaved-changes guard, like the logo link.
 */
export function SimpleLayout({
  actions,
  backHome = false,
  children,
}: {
  actions?: ReactNode;
  backHome?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <Container className="flex h-(--navbar-height) items-center justify-between gap-4">
          <Link to="/" aria-label={t('nav.home')} className="rounded-sm">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            {backHome && (
              <Link
                to="/"
                // short visible label on phones; the name always contains it (WCAG 2.5.3)
                aria-label={t('common.backHome')}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-small font-semibold whitespace-nowrap text-link hover:bg-blue-50"
              >
                <ArrowLeft aria-hidden="true" className="size-4 shrink-0 rtl:rotate-180" />
                <span className="sm:hidden">{t('common.home')}</span>
                <span className="hidden sm:inline">{t('common.backHome')}</span>
              </Link>
            )}
            <LanguageSwitch />
            {actions}
          </div>
        </Container>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-16">
        {children}
      </main>
    </div>
  );
}
