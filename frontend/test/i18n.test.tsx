import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LanguageSwitch } from '../src/components/layout/LanguageSwitch';
import i18n from '../src/i18n';
import ar from '../src/i18n/ar.json';
import en from '../src/i18n/en.json';
import portalAr from '../src/i18n/portal/ar.json';
import portalEn from '../src/i18n/portal/en.json';
import companyAr from '../src/i18n/company/ar.json';
import companyEn from '../src/i18n/company/en.json';

type Tree = { [key: string]: string | Tree };

const keys = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`),
  );

describe('i18n', () => {
  it('ar.json and en.json have exactly the same keys', () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });

  it('the customer-portal bundles (portal/*.json) have the same keys too', () => {
    expect(keys(portalAr).sort()).toEqual(keys(portalEn).sort());
  });

  it('the company-portal bundles (company/*.json) have the same keys too', () => {
    expect(keys(companyAr).sort()).toEqual(keys(companyEn).sort());
  });

  it('has a translation for every shared validation message and API error code', async () => {
    const { ERROR_CODES } = await import('@mirhalgo/shared');
    for (const code of ERROR_CODES) expect(en.errors).toHaveProperty(code);
  });

  it('switches language, <html lang dir> and saves the choice', async () => {
    render(<LanguageSwitch />);
    await userEvent.click(screen.getByRole('button', { name: 'التبديل إلى العربية' }));
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(localStorage.getItem('mirhalgo.lang')).toBe('ar');

    await userEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    expect(i18n.language).toBe('en');
  });
});
