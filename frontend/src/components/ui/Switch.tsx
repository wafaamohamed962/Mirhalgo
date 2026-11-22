import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { useField } from './useField';

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> & {
  label: ReactNode;
};

/** On/off toggle: a native checkbox with role="switch" (works with `register`). */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, id, ...rest },
  ref,
) {
  const { fieldId } = useField({ id });
  return (
    <label htmlFor={fieldId} className="inline-flex cursor-pointer items-center gap-3">
      <input
        ref={ref}
        id={fieldId}
        type="checkbox"
        role="switch"
        className="peer sr-only"
        {...rest}
      />
      <span
        aria-hidden="true"
        className="relative h-6 w-11 shrink-0 rounded-full bg-slate-200 transition-colors duration-200 ease-out peer-checked:bg-blue-600 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:opacity-50 after:absolute after:start-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-200 after:ease-out peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5"
      />
      <span className="text-small text-body">{label}</span>
    </label>
  );
});
