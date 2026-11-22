import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type FieldProps = {
  fieldId: string;
  errorId: string;
  hintId: string;
  label: ReactNode;
  /** i18n key (Zod messages are keys) or an already translated text. */
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  /** Use a <span> instead of <label> for controls labelled with aria-labelledby (OTP). */
  labelAs?: 'label' | 'span';
  children: ReactNode;
};

/** Label + control + hint/error, the layout shared by every form control. */
export function Field({
  fieldId,
  errorId,
  hintId,
  label,
  error,
  hint,
  required,
  labelAs = 'label',
  children,
}: FieldProps) {
  const { t } = useTranslation();
  const LabelTag = labelAs;

  return (
    <div className="flex flex-col gap-1.5">
      <LabelTag
        id={`${fieldId}-label`}
        {...(labelAs === 'label' && { htmlFor: fieldId })}
        className="text-small font-semibold text-heading"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ms-0.5 text-error">
            *
          </span>
        )}
      </LabelTag>
      {children}
      {hint && (
        <div id={hintId} className="text-caption text-muted">
          {hint}
        </div>
      )}
      {error && (
        <p id={errorId} className="text-caption text-error">
          {t(error)}
        </p>
      )}
    </div>
  );
}
