import { Toaster as SonnerToaster } from 'sonner';
import { useTranslation } from 'react-i18next';

/**
 * App-wide toast container (Sonner), styled with design tokens only.
 * Trigger toasts with `toast.success()` / `toast.error()` from 'sonner'.
 */
export function Toaster() {
  const { i18n } = useTranslation();

  return (
    <SonnerToaster
      position="top-center"
      dir={i18n.dir()}
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-full items-start gap-3 rounded-sm border border-slate-200 bg-white p-4 text-small text-heading shadow-lg',
          title: 'font-semibold',
          description: 'text-body',
          success: 'border-s-4 border-s-success',
          error: 'border-s-4 border-s-error',
          warning: 'border-s-4 border-s-warning',
          closeButton: 'order-last ms-auto text-muted hover:text-heading',
        },
      }}
    />
  );
}
