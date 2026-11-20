import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { Field } from './Field';
import { controlClasses } from './styles';
import { useField } from './useField';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: ReactNode;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, placeholder, error, hint, id, required, ...rest },
  ref,
) {
  const { fieldId, errorId, hintId, ariaProps } = useField({ id, error, hint });

  return (
    <Field {...{ fieldId, errorId, hintId, label, error, hint, required }}>
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          required={required}
          className={controlClasses(!!error, 'h-(--btn-height) appearance-none pe-10')}
          {...ariaProps}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-muted"
        />
      </div>
    </Field>
  );
});
