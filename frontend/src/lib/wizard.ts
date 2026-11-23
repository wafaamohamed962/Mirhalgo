import { useCallback, useEffect, useRef, useState } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

/*
 * Pieces shared by the multi-step forms (company registration MW_002, New Request MW_003 B5).
 * Each form keeps its own validation; these hold the step state and the draft autosave.
 */

/** Current step, completed steps, and moving between them (top of the page on every move). */
export function useWizardSteps<Id extends string>(first: Id) {
  const [step, setStep] = useState<Id>(first);
  const [completed, setCompleted] = useState<ReadonlySet<Id>>(new Set());

  const goTo = useCallback((next: Id) => {
    setStep(next);
    window.scrollTo({ top: 0 });
  }, []);
  const markCompleted = useCallback((id: Id) => setCompleted((done) => new Set(done).add(id)), []);
  const restart = useCallback(() => {
    setCompleted(new Set());
    setStep(first);
  }, [first]);

  return { step, completed, goTo, markCompleted, restart };
}

/**
 * Saves the form `delayMs` after the last edit. Resets (restore, start over) have no field
 * name and are not edits, so they never save. A save still pending when the form unmounts is
 * flushed, so "your draft is saved" stays true when the user leaves right after typing.
 * `cancel()` drops a pending save (start over, after a successful submit).
 */
export function useAutosave<T extends FieldValues>(
  form: UseFormReturn<T>,
  save: (values: T) => void,
  { delayMs, enabled = true }: { delayMs: number; enabled?: boolean },
) {
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const cancel = useCallback(() => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const flush = () => {
      pending.current = null;
      saveRef.current(form.getValues());
    };
    const subscription = form.watch((_values, { name }) => {
      if (!name) return;
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(flush, delayMs);
    });
    return () => {
      subscription.unsubscribe();
      if (pending.current) {
        clearTimeout(pending.current);
        flush();
      }
    };
  }, [form, delayMs, enabled]);

  return { cancel };
}

/** Scrolls to and focuses the first invalid field once React has rendered the errors. */
export function focusFirstError() {
  requestAnimationFrame(() => {
    const first = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    first?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    first?.focus({ preventScroll: true });
  });
}
