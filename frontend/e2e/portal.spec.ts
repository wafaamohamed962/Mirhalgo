import { expect, test } from '@playwright/test';
import { mockPortalApi, mockSupabase, seedSession, setLanguage, USER } from './mocks';

/*
 * Customer portal (MW_002 Part B) on the build with the MSW mocks enabled (like the deployed
 * preview). A stored session = logged-in customer; the data comes from the service worker,
 * except the parts that are already real: the user's own identity (the mocked Supabase profiles
 * row) and the New Request summary (GET /me/summary, MW_003 B2, mocked with mockPortalApi).
 */

const PAGES = [
  '/app/new-request',
  '/app/new-request/international',
  '/app/orders',
  '/app/orders/ord_118?tab=details',
  '/app/orders/ord_118?tab=offers',
  '/app/orders/ord_118?tab=timeline',
  '/app/companies',
  '/app/companies/co_nile',
  '/app/account/profile',
  '/app/account/security',
  // regression: sr-only switch labels escaped the table scroller and widened the page
  '/app/account/notifications',
  '/app/account/addresses',
  '/app/account/balance',
  '/app/account/preferences',
  '/app/account/privacy',
  '/app/notifications',
  '/app/support',
  '/app/support/tickets/tk_21',
];

test.beforeEach(async ({ page }) => {
  await seedSession(page);
  await mockSupabase(page);
  await mockPortalApi(page);
});

test('Arabic by default: RTL, sidebar on the right (desktop) / bottom navigation (mobile)', async ({
  page,
  isMobile,
}) => {
  await page.goto('/app');
  await expect(page).toHaveURL('/app/new-request');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1, name: 'طلب جديد' })).toBeVisible();
  await expect(page.getByRole('heading', { name: `مرحبًا، ${USER.firstName}` })).toBeVisible();

  const sidebar = page.locator('aside');
  const bottomNav = page.locator('nav.fixed');
  if (isMobile) {
    await expect(sidebar).toBeHidden();
    await expect(bottomNav).toBeVisible();
  } else {
    await expect(bottomNav).toBeHidden();
    const box = (await sidebar.boundingBox())!;
    const width = page.viewportSize()!.width;
    expect(box.x + box.width).toBeGreaterThan(width - 2); // hugs the right edge
  }
});

test('English: LTR, sidebar on the left', async ({ page, isMobile }) => {
  test.skip(isMobile, 'no sidebar on mobile');
  await setLanguage(page, 'en');
  await page.goto('/app/orders');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  const box = (await page.locator('aside').boundingBox())!;
  expect(box.x).toBeLessThan(2);
});

test('no horizontal overflow on any portal page', async ({ page }) => {
  test.setTimeout(120_000); // ~18 pages
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator('main')).not.toHaveAttribute('aria-busy', 'true');
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});

test('walk through every section with the mock data', async ({ page, isMobile }) => {
  await setLanguage(page, 'en');
  await page.goto('/app/new-request');
  await expect(page.getByText('Remaining requests: 3 of 5')).toBeVisible();
  await expect(page.getByText('You have an unfinished request')).toBeVisible();

  // orders → details → accept an offer
  await page.goto('/app/orders');
  await expect(page.getByRole('tab', { name: /All/ })).toContainText('9');
  await page.getByRole('link', { name: 'View the offers for order MG-R-2026-000118' }).click();
  await expect(page.getByText('MirhalGo Partner #001')).toBeVisible();
  await page.getByRole('button', { name: 'Accept' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText(/You selected MirhalGo Partner #001/)).toBeVisible();

  // companies → "Send request" opens New Request (company selection is off, plan item 9)
  await page.goto('/app/companies');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('link', { name: 'Send request' }).first().click();
  await expect(page).toHaveURL(/\/app\/new-request$/);

  // account, notifications, support
  await page.goto('/app/account/notifications');
  await expect(page.getByRole('switch').first()).toBeVisible();
  await page.goto('/app/notifications');
  await page.getByRole('tab', { name: /Unread/ }).click();
  await expect(
    page.getByRole('link', { name: /New offer on your request MG-R-2026-000118/ }),
  ).toBeVisible();
  await page.goto('/app/support');
  await page.getByRole('searchbox', { name: 'Search the questions' }).fill('anonymous');
  await expect(page.getByText('Why are offers anonymous?')).toBeVisible();

  if (isMobile) {
    await page.getByRole('button', { name: 'More' }).click();
    await expect(
      page.getByRole('dialog', { name: 'More' }).getByRole('link', { name: 'Help & Support' }),
    ).toBeVisible();
  }
});

test('"Back" on portal detail pages: previous page, else the logical parent', async ({
  page,
  isMobile,
}) => {
  await setLanguage(page, 'en');
  const back = page.getByRole('button', { name: 'Back to the previous page' });

  // from the list → back to the same list (with its tab)
  await page.goto('/app/orders');
  await page.getByRole('link', { name: 'View the offers for order MG-R-2026-000118' }).click();
  await expect(page).toHaveURL(/\/app\/orders\/ord_118/);
  await back.click();
  await expect(page).toHaveURL('/app/orders');

  // opened directly (a notification email, a new tab) → the parent page
  for (const [path, parent] of [
    ['/app/orders/ord_118', '/app/orders'],
    ['/app/companies/co_nile', '/app/companies'],
    ['/app/support/tickets/tk_21', '/app/support'],
    ['/app/notifications', '/app/new-request'], // /app → New Request
  ] as const) {
    await page.goto(path);
    await back.click();
    await expect(page, path).toHaveURL(parent);
  }

  // main sidebar pages have no "Back"
  for (const path of ['/app/new-request', '/app/orders', '/app/companies', '/app/account']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(back, path).toHaveCount(0);
  }

  // an account section: "Back" on mobile only (the desktop tabs are the navigation)
  await page.goto('/app/account/security');
  if (isMobile) {
    await back.click();
    await expect(page).toHaveURL('/app/account');
  } else {
    await expect(back).toBeHidden();
  }
});

for (const [lang, t] of [
  [
    'en',
    {
      tab: 'Offers received',
      search: 'Search by order number',
      sort: 'Sort',
      oldest: 'oldest',
      detail: /^View the offers for order MG-R-/,
      back: 'Back to the previous page',
    },
  ],
  [
    'ar',
    {
      tab: 'وصلت عروض',
      search: 'ابحث برقم الطلب',
      sort: 'الترتيب',
      oldest: 'oldest',
      detail: /^عرض عروض الطلب MG-R-/,
      back: 'رجوع إلى الصفحة السابقة',
    },
  ],
] as const) {
  test(`My Orders filter → order details → Back restores the list exactly (${lang})`, async ({
    page,
  }) => {
    await setLanguage(page, lang);
    await page.goto('/app/orders');
    await page.getByRole('tab', { name: new RegExp(`^${t.tab}`) }).click();
    await page.getByRole('combobox', { name: t.sort }).selectOption(t.oldest);
    await page
      .getByRole('searchbox', { name: t.search })
      .or(page.getByLabel(t.search))
      .first()
      .fill('MG-R-2026');
    await expect(page).toHaveURL(/search=MG-R-2026/); // debounced into the URL
    const filtered = page.url();

    await page.getByRole('link', { name: t.detail }).first().click();
    await expect(page).toHaveURL(/\/app\/orders\/ord_/);
    await page.getByRole('button', { name: t.back }).click();

    await expect(page).toHaveURL(filtered);
    await expect(page.getByRole('tab', { name: new RegExp(`^${t.tab}`) })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('combobox', { name: t.sort })).toHaveValue('oldest');
    await expect(page.getByLabel(t.search).first()).toHaveValue('MG-R-2026');
  });
}
