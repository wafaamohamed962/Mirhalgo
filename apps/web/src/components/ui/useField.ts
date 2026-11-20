import { useId } from 'react';

/**
 * Accessibility wiring shared by every form control (spec 8.4):
 * ids for the label, error and hint, plus `aria-invalid` / `aria-describedby`.
 */
export function useField({ id, error, hint }: { id?: string; error?: string; hint?: unknown }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ');

  return {
    fieldId,
    errorId,
    hintId,
    ariaProps: {
      'aria-invalid': error ? true : undefined,
      'aria-describedby': describedBy || undefined,
    },
  };
}
