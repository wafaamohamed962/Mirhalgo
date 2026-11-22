import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../components/ui';

/**
 * Asks before leaving a page with unsaved changes: in-app navigation shows a dialog, closing
 * or reloading the tab shows the browser prompt. Render the returned `dialog`.
 * Call `allowLeave()` right before navigating away on purpose (e.g. after saving).
 */
export function useUnsavedChangesGuard(
  dirty: boolean,
  texts: { title?: string; description?: string } = {},
) {
  const { t } = useTranslation();
  const allowed = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !allowed.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!allowed.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const dialog =
    blocker.state === 'blocked' ? (
      <ConfirmDialog
        title={texts.title ?? t('ui.leave.title')}
        description={texts.description ?? t('ui.leave.text')}
        confirmLabel={t('ui.leave.leave')}
        cancelLabel={t('ui.leave.stay')}
        tone="danger"
        onConfirm={() => blocker.proceed()}
        onCancel={() => blocker.reset()}
      />
    ) : null;

  return { dialog, allowLeave: () => (allowed.current = true) };
}
