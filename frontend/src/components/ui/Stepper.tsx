import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export type Step = {
  id: string;
  label: string;
  /** Done: shows a check and can be clicked to go back to it. */
  completed?: boolean;
  /** Not needed in this flow (e.g. Services when only "Other" is selected). */
  skipped?: boolean;
};

/**
 * Progress indicator with step names. Completed steps are buttons (`onSelect`);
 * the current step has aria-current="step".
 */
export function Stepper({
  steps,
  current,
  onSelect,
  label,
}: {
  steps: readonly Step[];
  current: number;
  onSelect: (index: number) => void;
  label: string;
}) {
  const { t, i18n } = useTranslation();

  return (
    <nav aria-label={label}>
      <ol className="flex items-start gap-1 sm:gap-2">
        {steps.map((step, index) => {
          const active = index === current;
          const done = Boolean(step.completed) && !step.skipped && !active;
          const circle = (
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-small font-semibold transition-colors duration-200 ease-out',
                active && 'border-blue-600 bg-blue-600 text-white',
                done && 'border-blue-600 bg-blue-50 text-blue-600',
                !active && !done && 'border-slate-200 bg-white text-muted',
              )}
            >
              {done ? (
                <Check aria-hidden="true" className="size-4" />
              ) : (
                (index + 1).toLocaleString(i18n.language)
              )}
            </span>
          );
          const text = (
            <span
              className={cn(
                'text-caption sm:text-small',
                active ? 'font-semibold text-heading' : 'text-muted',
                step.skipped && 'line-through',
              )}
            >
              {step.label}
              {step.skipped && <span className="sr-only"> ({t('ui.stepSkipped')})</span>}
              {done && <span className="sr-only"> ({t('ui.stepCompleted')})</span>}
            </span>
          );

          return (
            <li
              key={step.id}
              aria-current={active ? 'step' : undefined}
              className="flex flex-1 flex-col items-center gap-2 text-center"
            >
              {done ? (
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  className="flex flex-col items-center gap-2 rounded-sm"
                >
                  {circle}
                  {text}
                </button>
              ) : (
                <>
                  {circle}
                  {text}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
