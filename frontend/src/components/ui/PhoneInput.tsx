import { forwardRef, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { COUNTRIES, DEFAULT_COUNTRY, splitE164, toE164, type Country } from '@mirhalgo/shared';
import { Field } from './Field';
import { controlClasses } from './styles';
import { useField } from './useField';

const findCountry = (iso: string | undefined) => COUNTRIES.find((c) => c.iso === iso);

type PhoneInputProps = {
  label: ReactNode;
  /** E.164 value, e.g. "+201012345678" ("" while empty). */
  value?: string;
  onChange: (e164: string) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /**
   * ISO code of the dial code to offer while the number is empty (e.g. the company country,
   * MW_003 A2). A number the user already typed is never changed.
   */
  defaultCountry?: string;
};

/**
 * Country selector (default Egypt +20) + national number. Emits E.164 (spec 8.4).
 * Use with React Hook Form's <Controller>.
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { label, value = '', onChange, onBlur, name, id, error, required, disabled, defaultCountry },
  ref,
) {
  const { t, i18n } = useTranslation();
  const { fieldId, errorId, hintId, ariaProps } = useField({ id, error });
  // a value set from outside (restored draft) is shown; afterwards the input owns the text
  const [initial] = useState(() => splitE164(value));
  const [country, setCountry] = useState<Country>(
    initial?.country ?? findCountry(defaultCountry) ?? DEFAULT_COUNTRY,
  );
  const [national, setNational] = useState(initial?.national ?? '');

  // Follow the default country while nothing is typed yet.
  useEffect(() => {
    const next = findCountry(defaultCountry);
    if (next && !national) setCountry(next);
    // only when the default changes: not when the user picks a code and then clears the number
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCountry]);

  // Clear the local text when the form is reset from outside.
  useEffect(() => {
    if (!value && toE164(country.dial, national)) setNational('');
  }, [value, country.dial, national]);

  const countryNames = useMemo(
    () => new Intl.DisplayNames([i18n.language], { type: 'region' }),
    [i18n.language],
  );

  const update = (nextCountry: Country, nextNational: string) => {
    setCountry(nextCountry);
    setNational(nextNational);
    onChange(toE164(nextCountry.dial, nextNational));
  };

  return (
    <Field {...{ fieldId, errorId, hintId, label, error, required }}>
      {/* Phone numbers always read left-to-right, also in Arabic. */}
      <div dir="ltr" className="flex gap-2">
        <div className="relative w-24 shrink-0">
          <select
            aria-label={t('ui.countryCode')}
            value={country.iso}
            disabled={disabled}
            onChange={(event) => {
              const next = COUNTRIES.find((c) => c.iso === event.target.value) ?? DEFAULT_COUNTRY;
              update(next, national);
            }}
            className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
          >
            {COUNTRIES.map((c) => (
              <option key={c.iso} value={c.iso}>
                {`${countryNames.of(c.iso) ?? c.iso} (+${c.dial})`}
              </option>
            ))}
          </select>
          <span
            aria-hidden="true"
            className={controlClasses(
              false,
              'flex h-(--btn-height) items-center justify-between px-3 peer-focus-visible:border-blue-600 peer-focus-visible:bg-blue-50 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
            )}
          >
            +{country.dial}
            <ChevronDown className="size-4 text-muted" />
          </span>
        </div>
        <input
          ref={ref}
          id={fieldId}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={t('ui.phonePlaceholder')}
          value={national}
          required={required}
          disabled={disabled}
          onChange={(event) => update(country, event.target.value.replace(/[^\d\s-]/g, ''))}
          onBlur={onBlur}
          className={controlClasses(!!error, 'h-(--btn-height) min-w-0 flex-1')}
          {...ariaProps}
        />
      </div>
    </Field>
  );
});
