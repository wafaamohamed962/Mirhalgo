import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { COMBOBOX_OTHER, Combobox, type ComboboxOption } from '../src/components/ui/Combobox';
import { matchesSearch, normalizeSearch } from '../src/lib/search';
import { comboboxOptions, countryOptions } from '../src/services/api/reference';
import { AIRPORTS, COUNTRIES, PORTS } from './referenceFixtures';

/* Searchable select (MW_003 B1) + the search normaliser + reference → options helpers. */

const OPTIONS: ComboboxOption[] = [
  {
    value: 'EG-ALEXANDRIA',
    label: 'الإسكندرية',
    keywords: 'Alexandria',
    hint: 'EGALY',
    flag: 'EG',
  },
  { value: 'EG-DAMIETTA', label: 'دمياط', keywords: 'Damietta', hint: 'EGDAM', flag: 'EG' },
  { value: 'BR-SANTOS', label: 'São Paulo-Santos', keywords: 'سانتوس', flag: 'BR' },
];

function Harness({
  onSubmit = () => {},
  otherLabel,
  initial = null,
  error,
}: {
  onSubmit?: () => void;
  otherLabel?: string;
  initial?: string | null;
  error?: string;
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Combobox
        label="Port of loading"
        options={OPTIONS}
        value={value}
        onChange={setValue}
        otherLabel={otherLabel}
        error={error}
        required
      />
      <span data-testid="value">{value ?? ''}</span>
    </form>
  );
}

const value = () => screen.getByTestId('value').textContent;

describe('search normaliser', () => {
  it('ignores case, Arabic diacritics, letter variants, Latin accents and Arabic digits', () => {
    expect(normalizeSearch('الإسكندرية')).toBe(normalizeSearch('الاسكندريه'));
    expect(normalizeSearch('مُصْـر')).toBe('مصر');
    expect(normalizeSearch('São  PAULO')).toBe('sao paulo');
    expect(normalizeSearch('٤٠')).toBe('40');
    expect(matchesSearch('King Abdulaziz Port (Dammam)', 'dammam king')).toBe(true);
    expect(matchesSearch('Jeddah', 'riyadh')).toBe(false);
  });
});

describe('Combobox', () => {
  it('is an ARIA combobox: closed → opens on click with every option', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: /Port of loading/ });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-required', 'true');
    await user.click(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox', { name: /Port of loading/ })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('keyboard: ↓ moves the active option (aria-activedescendant), Enter chooses without submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const input = screen.getByRole('combobox');
    input.focus();
    await user.keyboard('{ArrowDown}'); // opens on the first option
    await user.keyboard('{ArrowDown}');
    const active = input.getAttribute('aria-activedescendant')!;
    expect(document.getElementById(active)).toHaveTextContent('دمياط');
    await user.keyboard('{Enter}');
    expect(value()).toBe('EG-DAMIETTA');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input).toHaveValue('دمياط');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    // reopening marks the selected option
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent('دمياط');
  });

  it('filters by label, code and the other language, forgiving spelling', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'الاسكندريه'); // no hamza, taa marbuta written as haa
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['الإسكندريةEGALY']);
    await user.clear(input);
    await user.type(input, 'egdam');
    expect(screen.getByRole('option')).toHaveTextContent('دمياط');
    await user.clear(input);
    await user.type(input, 'سانتوس');
    expect(screen.getByRole('option')).toHaveTextContent('São Paulo-Santos');
    await user.clear(input);
    await user.type(input, 'xyz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent('No matches');
  });

  it('Escape closes and keeps the value; typing then leaving restores the selected label', async () => {
    const user = userEvent.setup();
    render(<Harness initial="EG-ALEXANDRIA" />);
    const input = screen.getByRole('combobox');
    expect(input).toHaveValue('الإسكندرية');
    await user.type(input, 'دم');
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveValue('الإسكندرية');
    expect(value()).toBe('EG-ALEXANDRIA');
    await user.type(input, 'xx');
    await user.tab();
    expect(input).toHaveValue('الإسكندرية');
  });

  it('"Other" stays available (also with no matches) and emits COMBOBOX_OTHER', async () => {
    const user = userEvent.setup();
    render(<Harness otherLabel="Other (type it)" />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'xyz');
    expect(screen.getByRole('status')).toHaveTextContent('No matches');
    await user.click(screen.getByRole('option', { name: 'Other (type it)' }));
    expect(value()).toBe(COMBOBOX_OTHER);
    expect(input).toHaveValue('Other (type it)');
  });

  it('mouse: clicking an option chooses it; errors are wired to the input', async () => {
    const user = userEvent.setup();
    render(<Harness error="validation.required" />);
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('This field is required');
    await user.click(input);
    await user.click(screen.getByRole('option', { name: /São Paulo/ }));
    expect(value()).toBe('BR-SANTOS');
  });
});

describe('reference → combobox options', () => {
  it('localized label, other-language keyword, flag and an optional code', () => {
    const [cairo] = comboboxOptions(AIRPORTS, 'ar', { code: (a) => a.id });
    expect(cairo).toEqual({
      value: 'CAI',
      label: 'مطار القاهرة الدولي',
      keywords: 'Cairo International',
      hint: 'CAI',
      flag: 'EG',
    });
    const [alexandria] = comboboxOptions(PORTS, 'en', { code: (p) => p.unlocode });
    expect(alexandria).toMatchObject({
      label: 'Alexandria',
      keywords: 'الإسكندرية',
      hint: 'EGALY',
    });
    expect(countryOptions(COUNTRIES, 'en')[1]).toMatchObject({
      value: 'SA',
      label: 'Saudi Arabia',
      flag: 'SA',
    });
  });
});
