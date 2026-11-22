import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useModalBehavior } from '../../lib/useModalBehavior';
import { cn } from '../../lib/utils';

type ModalProps = {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  /** Buttons row at the bottom. */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
};

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

/**
 * Modal dialog (rendered while open): focus trap, Escape / backdrop / ✕ close,
 * body scroll lock, focus returns to the opener. Mark the element to focus first
 * with `data-autofocus`.
 */
export function Modal({ title, description, onClose, footer, size = 'md', children }: ModalProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useModalBehavior(panelRef, onClose);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
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
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'relative flex max-h-[90dvh] w-full animate-fade-in flex-col gap-5 overflow-y-auto rounded-lg bg-white p-6 shadow-lg',
          SIZES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-h3">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-small text-body">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('ui.close')}
            className="-me-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-slate-50 hover:text-heading"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        {children}
        {footer && (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
