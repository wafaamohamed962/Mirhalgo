import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';
import { buttonClasses, type ButtonShape, type ButtonVariant } from './styles';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  shape?: ButtonShape;
  fullWidth?: boolean;
  /** Shows a spinner and disables the button (prevents double submit). */
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant,
    shape,
    fullWidth,
    loading = false,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, shape, fullWidth, className })}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});
