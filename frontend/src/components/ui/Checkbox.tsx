import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useField } from './useField';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode;
  error?: string;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, error, id, ...rest },
  ref,
) {
  const { t } = useTranslation();
  const { fieldId, errorId, ariaProps } = useField({ id, error });

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-3">
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 cursor-pointer accent-blue-600"
          {...ariaProps}
          {...rest}
        />
        <label htmlFor={fieldId} className="cursor-pointer text-small text-body">
          {label}
        </label>
      </div>
      {error && (
        <p id={errorId} className="text-caption text-error">
          {t(error)}
        </p>
      )}
    </div>
  );
});
