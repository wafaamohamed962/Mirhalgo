import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Field } from './Field';
import { controlClasses } from './styles';
import { useField } from './useField';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, required, className, ...rest },
  ref,
) {
  const { fieldId, errorId, hintId, ariaProps } = useField({ id, error, hint });

  return (
    <Field {...{ fieldId, errorId, hintId, label, error, hint, required }}>
      <input
        ref={ref}
        id={fieldId}
        required={required}
        className={controlClasses(!!error, cn('h-(--btn-height)', className))}
        {...ariaProps}
        {...rest}
      />
    </Field>
  );
});
