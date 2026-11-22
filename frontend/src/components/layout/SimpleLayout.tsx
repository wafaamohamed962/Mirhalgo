import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Container } from './Container';
import { LanguageSwitch } from './LanguageSwitch';
import { Logo } from './Logo';

/** Light layout for auth pages, the dashboard placeholder and 404: logo + language switch. */
export function SimpleLayout({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <Container className="flex h-(--navbar-height) items-center justify-between gap-4">
          <Link to="/" aria-label={t('nav.home')} className="rounded-sm">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
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
