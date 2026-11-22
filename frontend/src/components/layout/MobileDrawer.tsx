import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { SECTION_IDS } from '../../lib/navigation';
import { useModalBehavior } from '../../lib/useModalBehavior';
import { cn } from '../../lib/utils';
import { LanguageSwitch } from './LanguageSwitch';
import { NavActions } from './NavActions';
import { SectionLink } from './SectionLink';

type MobileDrawerProps = { id: string; active: string | null; onClose: () => void };

/**
 * Slide-in menu for mobile (spec 3.1). Modal dialog: focus trap, Escape to close,
 * body scroll lock, focus returns to the menu button. Portaled to <body> because the
 * navbar's backdrop-filter would otherwise contain this fixed overlay.
 */
export function MobileDrawer({ id, active, onClose }: MobileDrawerProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  useModalBehavior(panelRef, onClose);

  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-navy-900/60"
      />
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.main')}
        className="absolute inset-y-0 end-0 flex w-80 max-w-[85vw] animate-drawer-in flex-col gap-8 bg-navy-900 p-6 shadow-lg rtl:animate-drawer-in-rtl"
      >
        <div className="flex items-center justify-between">
          <LanguageSwitch onDark />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('nav.closeMenu')}
            className="flex size-11 items-center justify-center rounded-full text-white hover:bg-white/10"
          >
            <X aria-hidden="true" className="size-6" />
          </button>
        </div>

        <nav aria-label={t('nav.main')}>
          <ul className="flex flex-col gap-1">
            {SECTION_IDS.map((section) => (
              <li key={section}>
                <SectionLink
                  section={section}
                  onNavigate={onClose}
                  aria-current={active === section ? 'true' : undefined}
                  className={cn(
                    'block rounded-sm px-4 py-3 text-base font-semibold no-underline',
                    active === section
                      ? 'bg-white/10 text-white'
                      : 'text-on-dark-muted hover:bg-white/5 hover:text-white',
                  )}
                >
                  {t(`nav.${section}`)}
                </SectionLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto">
          <NavActions stacked onNavigate={onClose} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
