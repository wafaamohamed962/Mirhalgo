import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { cn } from '../../lib/utils';

const STARS = [1, 2, 3, 4, 5] as const;

/** Read-only stars + the number, e.g. ★★★★☆ 4.6 */
export function StarRating({ value, className }: { value: number; className?: string }) {
  const { t, i18n } = useTranslation();
  const formatted = value.toLocaleString(i18n.language, { maximumFractionDigits: 1 });
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="sr-only">{t('ui.rating.outOf', { value: formatted })}</span>
      <span aria-hidden="true" className="flex">
        {STARS.map((star) => (
          <Star
            key={star}
            className={cn(
              'size-4',
              value >= star - 0.25 ? 'fill-warning text-warning' : 'text-slate-200',
            )}
          />
        ))}
      </span>
      <span aria-hidden="true" className="text-small font-semibold text-heading">
        {formatted}
      </span>
    </span>
  );
}

/**
 * Star picker as a radio group (keyboard + screen readers), labels Poor → Excellent
 * (spec B5).
 */
export function StarRatingInput({
  value,
  onChange,
  legend,
  error,
  disabled,
}: {
  value: number | undefined;
  onChange: (value: number) => void;
  legend: string;
  error?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const name = useId();
  const errorId = `${name}-error`;

  return (
    <fieldset aria-describedby={error ? errorId : undefined} disabled={disabled}>
      <legend className="mb-2 text-small font-semibold text-heading">
        {legend}
        <span aria-hidden="true" className="ms-0.5 text-error">
          *
        </span>
      </legend>
      <div className="flex items-center gap-1">
        {STARS.map((star) => (
          <label
            key={star}
            className="cursor-pointer rounded-full p-1 has-focus-visible:outline-3 has-focus-visible:outline-focus"
          >
            <input
              type="radio"
              name={name}
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
              className="sr-only"
            />
            <Star
              aria-hidden="true"
              className={cn(
                'size-8 transition-colors duration-150 ease-out',
                value && value >= star ? 'fill-warning text-warning' : 'text-slate-200',
              )}
            />
            <span className="sr-only">{t(`ui.rating.labels.${star}`)}</span>
          </label>
        ))}
        {value ? (
          <span className="ms-2 text-small font-semibold text-heading">
            {t(`ui.rating.labels.${value}`)}
          </span>
        ) : null}
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-caption text-error">
          {t(error)}
        </p>
      )}
    </fieldset>
  );
}
