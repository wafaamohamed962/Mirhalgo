import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ChoiceOption<V extends string = string> = {
  value: V;
  label: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
};

type BaseProps<V extends string> = {
  legend: ReactNode;
  options: ReadonlyArray<ChoiceOption<V>>;
  /** `card`: large selectable cards · `chip`: compact pills. */
  variant?: 'card' | 'chip';
  /** i18n key or translated text. */
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  className?: string;
};

const BOX = {
  card: 'flex items-start gap-3 rounded-lg border-2 p-4 text-start',
  chip: 'inline-flex min-h-(--btn-height) items-center gap-2 rounded-full border-2 px-4 text-small font-semibold',
} as const;

/**
 * Accessible group of native checkboxes / radios styled as cards or chips:
 * fieldset + legend, keyboard and screen-reader friendly, error wired with aria.
 */
function ChoiceGroup<V extends string>({
  type,
  legend,
  options,
  isChecked,
  onToggle,
  variant = 'chip',
  error,
  hint,
  required,
  disabled,
  name,
  className,
}: BaseProps<V> & {
  type: 'checkbox' | 'radio';
  isChecked: (value: V) => boolean;
  onToggle: (value: V) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ');

  return (
    <fieldset
      aria-describedby={describedBy || undefined}
      className={cn('flex min-w-0 flex-col gap-3', className)}
    >
      <legend className="mb-3 text-small font-semibold text-heading">
        {legend}
        {required && (
          <span aria-hidden="true" className="ms-0.5 text-error">
            *
          </span>
        )}
      </legend>
      <div className={variant === 'card' ? 'grid gap-3 sm:grid-cols-2' : 'flex flex-wrap gap-2'}>
        {options.map(({ value, label, description, icon: Icon }) => {
          const checked = isChecked(value);
          return (
            <label
              key={value}
              className={cn(
                BOX[variant],
                'cursor-pointer transition-colors duration-150 ease-out has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
                checked
                  ? 'border-blue-600 bg-blue-50 text-heading'
                  : 'border-slate-200 bg-white text-body hover:border-blue-600',
                error && !checked && 'border-error',
                disabled && 'pointer-events-none opacity-50',
              )}
            >
              <input
                type={type}
                name={name ?? id}
                value={value}
                checked={checked}
                disabled={disabled}
                aria-invalid={error ? true : undefined}
                onChange={() => onToggle(value)}
                className="sr-only"
              />
              {variant === 'card' && Icon && (
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-full',
                    checked ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600',
                  )}
                >
                  <Icon aria-hidden="true" className="size-5" />
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={variant === 'card' ? 'font-semibold text-heading' : undefined}>
                  {label}
                </span>
                {description && <span className="text-small text-muted">{description}</span>}
              </span>
              {checked && (
                <span
                  aria-hidden="true"
                  className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"
                >
                  <Check className="size-3.5" />
                </span>
              )}
            </label>
          );
        })}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-caption text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-caption text-error">
          {t(error)}
        </p>
      )}
    </fieldset>
  );
}

/** Multi-select (min / max rules live in the shared Zod schema). Use with <Controller>. */
export function CheckboxGroup<V extends string>({
  value = [],
  onChange,
  ...props
}: BaseProps<V> & { value?: readonly V[]; onChange: (value: V[]) => void }) {
  return (
    <ChoiceGroup
      {...props}
      type="checkbox"
      isChecked={(option) => value.includes(option)}
      onToggle={(option) =>
        onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option])
      }
    />
  );
}

/** Single choice. Use with <Controller>. */
export function RadioGroup<V extends string>({
  value,
  onChange,
  ...props
}: BaseProps<V> & { value?: V; onChange: (value: V) => void }) {
  return (
    <ChoiceGroup
      {...props}
      type="radio"
      isChecked={(option) => value === option}
      onToggle={onChange}
    />
  );
}
