import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

/**
 * Modals whose open state lives in the URL (MW_004 spec B11: `?order=MG1029`), so a link or a
 * reload opens them (plan Q18). Opening pushes a history entry, so the browser's Back closes
 * the modal. Closing goes back to that entry, or, for a modal opened from a link (nothing to
 * go back to), removes its params with `replace`.
 */
export function useUrlModals() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const openedHere = (location.state as { modal?: boolean } | null)?.modal === true;

  const open = useCallback(
    (values: Record<string, string>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(values)) next.set(key, value);
      void navigate({ search: `?${next.toString()}` }, { state: { modal: true } });
    },
    [params, navigate],
  );

  const close = useCallback(
    (keys: readonly string[]) => {
      if (openedHere) {
        void navigate(-1);
        return;
      }
      const next = new URLSearchParams(params);
      for (const key of keys) next.delete(key);
      const search = next.toString();
      void navigate({ search: search ? `?${search}` : '' }, { replace: true });
    },
    [openedHere, params, navigate],
  );

  return { params, open, close };
}
