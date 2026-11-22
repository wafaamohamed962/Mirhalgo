import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { PASSWORD_MAX } from '@mirhalgo/shared';
import { Field } from './Field';
import { PasswordStrength } from './PasswordStrength';
import { controlClasses } from './styles';
import { useField } from './useField';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode;
  error?: string;
  /** Shows the strength meter + rule checklist (sign up / reset password). */
  showStrength?: boolean;
};

/** Password field with show/hide toggle and optional strength meter (spec 8.4). */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { label, error, showStrength = false, id, required, onChange, ...rest },
    ref,
  ) {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    // Tracked locally so the meter works with uncontrolled (React Hook Form) inputs.
    const [value, setValue] = useState('');
    const hint = showStrength ? <PasswordStrength password={value} /> : undefined;
    const { fieldId, errorId, hintId, ariaProps } = useField({ id, error, hint });
    const ToggleIcon = visible ? EyeOff : Eye;

    return (
      <Field {...{ fieldId, errorId, hintId, label, error, hint, required }}>
        <div className="relative">
          <input
            ref={ref}
            id={fieldId}
            type={visible ? 'text' : 'password'}
            required={required}
            maxLength={PASSWORD_MAX}
            className={controlClasses(!!error, 'h-(--btn-height) pe-12')}
            onChange={(event) => {
              setValue(event.target.value);
              onChange?.(event);
            }}
            {...ariaProps}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={t(visible ? 'ui.hidePassword' : 'ui.showPassword')}
            aria-pressed={visible}
            aria-controls={fieldId}
            className="absolute end-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-sm text-muted hover:text-heading"
          >
            <ToggleIcon aria-hidden="true" className="size-5" />
          </button>
        </div>
      </Field>
    );
  },
);
