import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { scrollToTop, SECTION_IDS } from '../../lib/navigation';
import { useActiveSection } from '../../lib/useActiveSection';
import { useScrolledPast } from '../../lib/useScrolledPast';
import { cn } from '../../lib/utils';
import { Container } from './Container';
import { LanguageSwitch } from './LanguageSwitch';
import { Logo } from './Logo';
import { MobileDrawer } from './MobileDrawer';
import { NavActions } from './NavActions';
import { SectionLink } from './SectionLink';

const SOLID_AFTER_PX = 80;

/**
 * Sticky landing navbar (spec 3.1): transparent over the hero, solid navy with blur
 * + shadow after ~80px, active link via IntersectionObserver, drawer on mobile.
 */
export function Navbar() {
  const { t } = useTranslation();
  const solid = useScrolledPast(SOLID_AFTER_PX);
  const active = useActiveSection(SECTION_IDS);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow] duration-300 ease-out',
        solid ? 'bg-navy-900/90 shadow-lg backdrop-blur-md' : 'bg-transparent',
      )}
    >
      <a
        href="#main"
        className="sr-only rounded-sm bg-white px-4 py-2 text-heading focus:not-sr-only focus:absolute focus:start-4 focus:top-4"
      >
        {t('nav.skip')}
      </a>
      <Container className="flex h-(--navbar-height) items-center justify-between gap-4">
        <a
          href="#top"
          onClick={(event) => {
            event.preventDefault();
            scrollToTop();
          }}
          aria-label={t('nav.home')}
          className="rounded-sm"
        >
          <Logo onDark />
        </a>

        <nav aria-label={t('nav.main')} className="hidden md:block">
          <ul className="flex items-center gap-1">
            {SECTION_IDS.map((id) => (
              <li key={id}>
                <SectionLink
                  section={id}
                  aria-current={active === id ? 'true' : undefined}
                  className={cn(
                    'rounded-full px-4 py-2 text-base font-semibold no-underline transition-colors duration-200',
                    active === id
                      ? 'bg-white/10 text-white'
                      : 'text-on-dark-muted hover:text-white',
                  )}
                >
                  {t(`nav.${id}`)}
                </SectionLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitch onDark />
          <NavActions />
        </div>

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={t('nav.openMenu')}
          aria-expanded={drawerOpen}
          aria-controls="mobile-drawer"
          className="flex size-11 items-center justify-center rounded-full text-white hover:bg-white/10 md:hidden"
        >
          <Menu aria-hidden="true" className="size-6" />
        </button>
      </Container>

      {drawerOpen && (
        <MobileDrawer id="mobile-drawer" active={active} onClose={() => setDrawerOpen(false)} />
      )}
    </header>
  );
}
