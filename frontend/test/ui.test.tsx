import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, Input, OtpInput, PasswordInput, PhoneInput } from '../src/components/ui';

function ControlledOtp({ onComplete }: { onComplete: (code: string) => void }) {
  const [value, setValue] = useState('');
  return <OtpInput label="Code" value={value} onChange={setValue} onComplete={onComplete} />;
}

function ControlledPhone({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <PhoneInput
      label="Phone"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('OtpInput', () => {
  const boxes = () => screen.getAllByRole('textbox');

  it('auto-advances and submits when complete', async () => {
    const onComplete = vi.fn();
    render(<ControlledOtp onComplete={onComplete} />);
    await userEvent.click(boxes()[0]!);
    await userEvent.keyboard('123456');
    expect(
      boxes()
        .map((b) => (b as HTMLInputElement).value)
        .join(''),
    ).toBe('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('accepts a pasted code and ignores non-digits', async () => {
    const onComplete = vi.fn();
    render(<ControlledOtp onComplete={onComplete} />);
    await userEvent.click(boxes()[0]!);
    await userEvent.paste('12-34 56');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('backspace clears and moves to the previous box', async () => {
    render(<ControlledOtp onComplete={vi.fn()} />);
    await userEvent.click(boxes()[0]!);
    await userEvent.keyboard('12{Backspace}{Backspace}');
    expect(boxes()[0]).toHaveValue('');
    expect(boxes()[0]).toHaveFocus();
  });

  it('uses the numeric keyboard', () => {
    render(<ControlledOtp onComplete={vi.fn()} />);
    for (const box of boxes()) expect(box).toHaveAttribute('inputmode', 'numeric');
  });
});

describe('PasswordInput', () => {
  it('toggles visibility', async () => {
    render(<PasswordInput label="Password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
  });

  it('shows the strength meter', async () => {
    render(<PasswordInput label="Password" showStrength />);
    const meter = screen.getByRole('meter', { name: 'Password strength' });
    await userEvent.type(screen.getByLabelText('Password'), 'abc');
    expect(meter).toHaveAttribute('aria-valuetext', 'Weak');
    await userEvent.type(screen.getByLabelText('Password'), 'DEF12!x');
    expect(meter).toHaveAttribute('aria-valuenow', '5');
    expect(meter).toHaveAttribute('aria-valuetext', 'Strong');
  });
});

describe('PhoneInput', () => {
  it('emits E.164 with Egypt (+20) as default, dropping the leading 0', async () => {
    const onChange = vi.fn();
    render(<ControlledPhone onChange={onChange} />);
    expect(screen.getByRole('combobox', { name: 'Country code' })).toHaveValue('EG');
    await userEvent.type(screen.getByLabelText('Phone'), '010 1234 5678');
    expect(onChange).toHaveBeenLastCalledWith('+201012345678');
  });

  it('changes the dial code', async () => {
    const onChange = vi.fn();
    render(<ControlledPhone onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Country code' }), 'SA');
    await userEvent.type(screen.getByLabelText('Phone'), '501234567');
    expect(onChange).toHaveBeenLastCalledWith('+966501234567');
  });
});

describe('Input / Button accessibility', () => {
  it('links the error message with aria-invalid + aria-describedby', () => {
    render(<Input label="Email" error="validation.email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid email address');
  });

  it('loading button is disabled and busy (no double submit)', () => {
    render(<Button loading>Send</Button>);
    const button = screen.getByRole('button', { name: 'Send' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
