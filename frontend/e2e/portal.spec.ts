import { expect, test } from '@playwright/test';
import { mockPortalApi, mockSupabase, seedCustomerSession, setLanguage, USER } from './mocks';

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
  await seedCustomerSession(page);
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

  // companies → select → New Request with "Sending to"
  await page.goto('/app/companies');
  await page.getByRole('checkbox', { name: 'Select Nile Bridge Logistics' }).check();
  await page.getByRole('button', { name: 'Send request to selected' }).click();
  await expect(page).toHaveURL(/\/app\/new-request\?companies=co_nile/);
  await expect(page.getByText('Sending to:')).toBeVisible();

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
