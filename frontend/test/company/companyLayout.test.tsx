import { readFileSync } from 'node:fs';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SERVICE_CATEGORIES } from '@mirhalgo/shared';
import i18n from '../../src/i18n';
import '../../src/i18n/company';
import { AuthContext, type AuthContextValue } from '../../src/features/auth/authContext';
import { CategoryChip, CategoryIcon } from '../../src/features/companyPortal/categories';
import { CATEGORY_LOOK, categoryStripe } from '../../src/features/companyPortal/categoryLook';
import { clearSeen, useSeen } from '../../src/features/companyPortal/seen';
import { useOfferTotal } from '../../src/features/companyPortal/useOfferTotal';
import { useMoney } from '../../src/lib/money';
import { renderCompany, resetCompanyMocks, server, signOut } from './renderCompany';

/* Company portal shell (MW_004 B2): sidebar, badges, top bar, drawer, Back, categories, New. */

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  resetCompanyMocks();
  localStorage.clear();
  signOut.mockClear();
});

const sidebar = () => within(screen.getAllByRole('navigation', { name: 'Company portal' })[0]!);

describe('layout', () => {
  it('sidebar: brand, the 6 sections in order, 3 count badges with their meaning', async () => {
    renderCompany('/company/overview');
    expect(screen.getByText('MirhalGo — Partner Companies Portal')).toBeInTheDocument();
    const links = sidebar().getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/company/overview',
      '/company/requests',
      '/company/offers',
      '/company/competitors',
      '/company/inquiries',
      '/company/settings',
    ]);
    // the counts come from GET /company/dashboard (mock state)
    expect(
      await sidebar().findByRole(
        'link',
        { name: /Client inquiries\s*6\s+inquiries awaiting reply/ },
        // the first request also loads the Supabase client (the token)
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(
      sidebar().getByRole('link', {
        name: /Available requests\s*\d+\s+requests without our offer/,
      }),
    ).toBeInTheDocument();
    expect(
      sidebar().getByRole('link', { name: /Our submitted offers\s*\d+\s+offers under review/ }),
    ).toBeInTheDocument();
    expect(sidebar().getByRole('link', { name: 'Competitor offers' })).toBeInTheDocument();
  });

  it('top bar: welcome with the alias, approved status, language switch; company block + logout', async () => {
    renderCompany('/company/overview');
    expect(await screen.findByText('Welcome, الناقل الذهبي')).toBeInTheDocument();
    expect(screen.getByText('Approved account')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'التبديل إلى العربية' })).toBeInTheDocument();
    // sidebar bottom: display name + login email
    expect(screen.getAllByText('demo.company@mirhalgo.com').length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole('button', { name: 'Log out' })[0]!);
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('Back on every section but Overview; the page title is the document title', async () => {
    renderCompany('/company/offers');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Our submitted offers' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to the previous page' })).toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe('Our submitted offers | Partner Companies Portal'),
    );
  });

  it('Overview has no Back (it is the portal root)', async () => {
    renderCompany('/company/overview');
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Back to the previous page' }),
    ).not.toBeInTheDocument();
  });

  it('mobile drawer: the menu button opens the sections, Esc closes it', async () => {
    const user = userEvent.setup();
    renderCompany('/company/overview');
    await user.click(screen.getByRole('button', { name: 'Open the menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(drawer).getAllByRole('link')).toHaveLength(6);
    expect(within(drawer).getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Arabic: the copy switches (formal Arabic) and the page is RTL', async () => {
    await act(() => i18n.changeLanguage('ar'));
    renderCompany('/company/inquiries');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'استفسارات العملاء' }),
    ).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(screen.getByText('مرحال جو — بوابة الشركات الشريكة')).toBeInTheDocument();
    await act(() => i18n.changeLanguage('en'));
  });
});

describe('category system (spec B2)', () => {
  it('every category has an icon tile, a chip with its name and a stripe', () => {
    render(
      <>
        {SERVICE_CATEGORIES.map((category) => (
          <div key={category} data-testid={category} className={categoryStripe(category)}>
            <CategoryIcon category={category} />
            <CategoryChip category={category} />
          </div>
        ))}
      </>,
    );
    expect(screen.getByText('Sea freight & customs')).toBeInTheDocument();
    expect(screen.getByText('SHEIN')).toBeInTheDocument();
    for (const category of SERVICE_CATEGORIES) {
      expect(screen.getByTestId(category)).toHaveClass(
        'border-s-4',
        CATEGORY_LOOK[category].stripe,
      );
      expect(screen.getByTestId(category).querySelector('svg')).not.toBeNull();
    }
  });

  it('only theme colours (tokens.css), never a raw colour value', () => {
    const theme = readFileSync('src/styles/globals.css', 'utf8');
    const classes = Object.values(CATEGORY_LOOK).flatMap((look) =>
      `${look.tone} ${look.stripe}`.split(' '),
    );
    for (const name of classes) {
      const colour = name.replace(/^(bg|text|border-s)-/, '');
      expect(theme).toContain(`--color-${colour}:`);
    }
  });
});

describe('"New" badges (spec B2)', () => {
  const auth = (id: string) =>
    ({ session: { user: { id } } as unknown as Session }) as AuthContextValue;
  const wrapper =
    (id: string) =>
    ({ children }: { children: ReactNode }) => (
      <AuthContext.Provider value={auth(id)}>{children}</AuthContext.Provider>
    );

  it('new until opened; per account; a changed offer status is new again; reset forgets', () => {
    const { result } = renderHook(() => useSeen(), { wrapper: wrapper('company-a') });
    const other = renderHook(() => useSeen(), { wrapper: wrapper('company-b') });
    expect(result.current.isNew('request', 'MG1029')).toBe(true);
    act(() => result.current.markSeen('request', 'MG1029'));
    expect(result.current.isNew('request', 'MG1029')).toBe(false);
    expect(other.result.current.isNew('request', 'MG1029')).toBe(true);

    act(() => result.current.markSeen('offer', 'OF-100001', 'under_review'));
    expect(result.current.isNew('offer', 'OF-100001', 'under_review')).toBe(false);
    expect(result.current.isNew('offer', 'OF-100001', 'accepted')).toBe(true);

    act(() => clearSeen('company-a'));
    expect(result.current.isNew('request', 'MG1029')).toBe(true);
  });
});

describe('money (one shared formatter, spec B5 format in the company portal)', () => {
  it('the default (customer portal) is unchanged; "plain" = Western digits + the currency name', async () => {
    const money = renderHook(() => useMoney()).result.current;
    expect(money(38500, 'EGP')).toBe(
      new Intl.NumberFormat('en', {
        style: 'currency',
        currency: 'EGP',
        maximumFractionDigits: 0,
      }).format(38500),
    );

    const total = renderHook(() => useOfferTotal());
    expect(total.result.current({ foreign: { amount: 1000, currency: 'USD' }, egp: 38000 })).toBe(
      '1,000 USD + 38,000 EGP',
    );
    await act(() => i18n.changeLanguage('ar'));
    total.rerender();
    expect(total.result.current({ foreign: { amount: 1000, currency: 'USD' }, egp: 38000 })).toBe(
      '1,000 دولار + 38,000 جنيه',
    );
    expect(total.result.current({ egp: 5200 })).toBe('5,200 جنيه');
    expect(total.result.current({ foreign: { amount: 12.5, currency: 'EUR' } })).toBe('12.5 يورو');
    await act(() => i18n.changeLanguage('en'));
  });
});
