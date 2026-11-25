import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { LanguageSwitch } from '../layout/LanguageSwitch';
import { useModalBehavior } from '../../lib/useModalBehavior';

/** Mobile drawer of a portal (end side): language, close, then `children`. Focus trap + Esc. */
export function PortalDrawer({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  useModalBehavior(panelRef, onClose);

  return (
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
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="absolute inset-y-0 end-0 flex w-72 max-w-[85vw] animate-drawer-in flex-col gap-2 overflow-y-auto bg-navy-900 p-5 rtl:animate-drawer-in-rtl"
      >
        <div className="mb-4 flex items-center justify-between">
          <LanguageSwitch onDark />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('ui.close')}
            className="flex size-11 items-center justify-center rounded-full text-white hover:bg-white/10"
          >
            <X aria-hidden="true" className="size-6" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
