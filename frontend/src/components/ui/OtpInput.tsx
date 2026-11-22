import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { OTP_LENGTH } from '@mirhalgo/shared';
import { cn } from '../../lib/utils';
import { Field } from './Field';
import { controlClasses } from './styles';
import { useField } from './useField';

type OtpInputProps = {
  label: ReactNode;
  /** Digits entered so far (controlled). */
  value: string;
  onChange: (code: string) => void;
  /** Called once all boxes are filled (auto-submit, spec 8.4). */
  onComplete?: (code: string) => void;
  error?: string;
  disabled?: boolean;
  /** Focus the first box when the page opens (the code is its only task). */
  focusOnMount?: boolean;
};

const emptyDigits = () => Array<string>(OTP_LENGTH).fill('');

/** 6 boxes: auto-advance, backspace, arrow keys, paste full code, numeric keyboard. */
export function OtpInput({
  label,
  value,
  onChange,
  onComplete,
  error,
  disabled,
  focusOnMount,
}: OtpInputProps) {
  const { t } = useTranslation();
  const { fieldId, errorId, hintId, ariaProps } = useField({ error });
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const [digits, setDigits] = useState(emptyDigits);

  useEffect(() => {
    if (focusOnMount) inputs.current[0]?.focus();
  }, [focusOnMount]);

  // External reset (e.g. after a wrong code) clears every box.
  useEffect(() => {
    if (!value) setDigits(emptyDigits());
  }, [value]);

  const focusBox = (index: number) =>
    inputs.current[Math.max(0, Math.min(index, OTP_LENGTH - 1))]?.focus();

  /** Writes `chars` starting at `start`, then moves focus and notifies the parent. */
  const fill = (start: number, chars: string) => {
    const next = [...digits];
    [...chars].slice(0, OTP_LENGTH - start).forEach((char, offset) => {
      next[start + offset] = char;
    });
    setDigits(next);
    const code = next.join('');
    onChange(code);
    focusBox(start + chars.length);
    if (code.length === OTP_LENGTH) onComplete?.(code);
  };

  const handleChange = (index: number, raw: string) => {
    const chars = raw.replace(/\D/g, '');
    if (!chars) return;
    // iOS/Android one-time-code autofill inserts the whole code into one box.
    if (chars.length >= OTP_LENGTH) fill(0, chars);
    else fill(index, chars.slice(-1)); // typing into a filled box keeps the newest digit
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const target = digits[index] ? index : index - 1;
      if (target < 0) return;
      const next = [...digits];
      next[target] = '';
      setDigits(next);
      onChange(next.join(''));
      focusBox(target);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (pasted) fill(pasted.length >= OTP_LENGTH ? 0 : index, pasted);
  };

  return (
    <Field {...{ fieldId, errorId, hintId, label, error }} labelAs="span">
      <div
        role="group"
        aria-labelledby={`${fieldId}-label`}
        dir="ltr"
        className="flex justify-center gap-2 sm:gap-3"
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputs.current[index] = el;
            }}
            id={index === 0 ? fieldId : undefined}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            aria-label={t('ui.otpDigit', { index: index + 1, total: OTP_LENGTH })}
            value={digit}
            disabled={disabled}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            onFocus={(event) => event.target.select()}
            className={cn(
              controlClasses(!!error),
              'size-12 px-0 text-center text-h3 font-extrabold sm:size-14',
            )}
            {...ariaProps}
          />
        ))}
      </div>
    </Field>
  );
}
