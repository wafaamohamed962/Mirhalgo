import { forwardRef, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown } from 'lucide-react';
import { matchesSearch } from '../../lib/search';
import { cn } from '../../lib/utils';
import { Field } from './Field';
import { Flag } from './Flag';
import { controlClasses } from './styles';
import { useField } from './useField';

/** Value emitted by the "Other" choice; the form then shows a text field for the manual value. */
export const COMBOBOX_OTHER = '__other__';

export type ComboboxOption = {
  value: string;
  label: string;
  /** ISO country code: shows its flag. */
  flag?: string;
  /** Secondary text, e.g. an IATA code; searchable too. */
  hint?: string;
  /** Extra search terms, e.g. the name in the other language. */
  keywords?: string;
};

type ComboboxProps = {
  label: ReactNode;
  options: readonly ComboboxOption[];
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  id?: string;
  placeholder?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /** The options are still loading. */
  loading?: boolean;
  /** Adds an "Other" choice at the end (always offered, also while searching). */
  otherLabel?: string;
};

/**
 * Searchable select (MW_003 B1: countries, ports, airports…), WAI-ARIA combobox pattern: focus
 * stays in the input, the active option is announced with aria-activedescendant. Keyboard:
 * ↓/↑ move (and open), Home/End, Enter choose, Esc close, typing filters. Works with React Hook
 * Form's <Controller> (value / onChange / onBlur / ref).
 */
export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(function Combobox(
  {
    label,
    options,
    value,
    onChange,
    onBlur,
    id,
    placeholder,
    hint,
    error,
    required,
    disabled,
    loading = false,
    otherLabel,
  },
  ref,
) {
  const { t } = useTranslation();
  const { fieldId, errorId, hintId, ariaProps } = useField({ id, error, hint });
  const listId = `${fieldId}-listbox`;
  const optionId = (index: number) => `${fieldId}-option-${index}`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const other = useMemo<ComboboxOption | null>(
    () => (otherLabel ? { value: COMBOBOX_OTHER, label: otherLabel } : null),
    [otherLabel],
  );
  const selected =
    options.find((option) => option.value === value) ??
    (other && value === COMBOBOX_OTHER ? other : null);
  const filtered = useMemo(() => {
    const matches = query.trim()
      ? options.filter((o) =>
          matchesSearch(`${o.label} ${o.hint ?? ''} ${o.keywords ?? ''}`, query),
        )
      : options;
    return other ? [...matches, other] : matches;
  }, [options, query, other]);

  const showActive = (index: number) => {
    setActive(index);
    requestAnimationFrame(() =>
      document.getElementById(optionId(index))?.scrollIntoView?.({ block: 'nearest' }),
    );
  };
  const openList = () => {
    if (disabled) return;
    setOpen(true);
    showActive(
      Math.max(
        0,
        filtered.findIndex((option) => option.value === value),
      ),
    );
  };
  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const choose = (option: ComboboxOption) => {
    onChange(option.value);
    close();
  };
  const move = (step: number) =>
    showActive(Math.min(Math.max(active + step, 0), Math.max(filtered.length - 1, 0)));

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        if (!open) openList();
        else move(event.key === 'ArrowDown' ? 1 : -1);
        break;
      case 'Home':
      case 'End':
        if (!open) return;
        event.preventDefault();
        showActive(event.key === 'Home' ? 0 : Math.max(filtered.length - 1, 0));
        break;
      case 'Enter':
        if (!open) return;
        event.preventDefault(); // never submits the form while choosing
        if (filtered[active]) choose(filtered[active]);
        break;
      case 'Escape':
        if (!open) return;
        event.preventDefault();
        close();
        break;
      case 'Tab':
        close();
        break;
    }
  };

  const status = loading
    ? t('common.loading')
    : filtered.length === 0 || (other && filtered.length === 1 && query.trim())
      ? t('ui.combobox.noResults')
      : null;
  const flag = open ? undefined : selected?.flag;

  return (
    <Field {...{ fieldId, errorId, hintId, label, error, hint, required }}>
      <div className="relative">
        {flag && (
          // wrapper: flag-icons sets `position: relative` on the flag itself
          <span className="pointer-events-none absolute start-4 top-1/2 flex -translate-y-1/2">
            <Flag code={flag} />
          </span>
        )}
        <input
          ref={ref}
          id={fieldId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? optionId(active) : undefined}
          aria-required={required || undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={open ? query : (selected?.label ?? '')}
          placeholder={open ? (selected?.label ?? placeholder) : placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onClick={() => (open ? close() : openList())}
          onKeyDown={onKeyDown}
          onBlur={() => {
            close();
            onBlur?.();
          }}
          className={controlClasses(!!error, cn('h-(--btn-height) pe-10', flag && 'ps-12'))}
          {...ariaProps}
        />
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-muted transition-transform duration-150',
            open && 'rotate-180',
          )}
        />

        {open && (
          <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-sm border border-slate-200 bg-white shadow-lg">
            {status && (
              <p role="status" className="px-4 py-3 text-small text-muted">
                {status}
              </p>
            )}
            <ul
              id={listId}
              role="listbox"
              aria-labelledby={`${fieldId}-label`}
              className="max-h-64 overflow-y-auto py-1"
            >
              {!loading &&
                filtered.map((option, index) => {
                  const isSelected = option.value === value;
                  return (
                    // The keyboard is handled by the input (aria-activedescendant), as the
                    // WAI-ARIA combobox pattern requires: options only need the mouse.
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                    <li
                      key={option.value}
                      id={optionId(index)}
                      role="option"
                      aria-selected={isSelected}
                      // keep the focus in the input (no blur before the click)
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(option)}
                      onMouseMove={() => index !== active && setActive(index)}
                      className={cn(
                        'flex min-h-11 cursor-pointer items-center gap-3 px-4 py-2 text-base text-heading',
                        index === active && 'bg-blue-50',
                        option.value === COMBOBOX_OTHER &&
                          'border-t border-slate-200 font-semibold',
                      )}
                    >
                      {option.flag && <Flag code={option.flag} />}
                      <span className="min-w-0 flex-1">{option.label}</span>
                      {option.hint && (
                        <span dir="ltr" className="text-caption text-muted">
                          {option.hint}
                        </span>
                      )}
                      <Check
                        aria-hidden="true"
                        className={cn('size-4 shrink-0 text-blue-600', !isSelected && 'invisible')}
                      />
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
      </div>
    </Field>
  );
});
