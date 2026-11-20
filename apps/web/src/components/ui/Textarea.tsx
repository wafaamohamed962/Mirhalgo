import { forwardRef, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Field } from './Field';
import { controlClasses } from './styles';
import { useField } from './useField';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, id, required, rows = 5, ...rest },
  ref,
) {
  const { fieldId, errorId, hintId, ariaProps } = useField({ id, error, hint });

  return (
    <Field {...{ fieldId, errorId, hintId, label, error, hint, required }}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        required={required}
        className={controlClasses(!!error, 'resize-y py-3')}
        {...ariaProps}
        {...rest}
      />
    </Field>
  );
});
