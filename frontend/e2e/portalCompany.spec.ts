import { expect, test, type Page } from '@playwright/test';
import { mockMeApi, mockSupabase, seedSession, setLanguage, USER } from './mocks';

/*
 * Company portal shell (MW_004 B2) on the build with the MSW mocks on: an approved company's
 * stored session; role + status from GET /api/me (mocked here: it is the real API), the
 * portal data from the service worker (src/mocks/company), persisted per account.
 */

const SECTIONS = ['overview', 'requests', 'offers', 'competitors', 'inquiries', 'settings'];

test.beforeEach(async ({ page }) => {
  await seedSession(page, 'company');
  await mockSupabase(page, 'company', 'approved');
  await mockMeApi(page, 'company', 'approved');
});

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test('Arabic by default: RTL, sidebar on the right with 3 badges (desktop) / a drawer (mobile)', async ({
  page,
  isMobile,
}) => {
  await page.goto('/company');
  await expect(page).toHaveURL('/company/overview', { timeout: 15_000 });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1, name: 'نظرة عامة' })).toBeVisible();
  await expect(page.getByText('مرحبًا بكم، الناقل الذهبي')).toBeVisible();

  const sidebar = page.locator('aside');
  if (isMobile) {
    await expect(sidebar).toBeHidden();
    await page.getByRole('button', { name: 'فتح القائمة' }).click();
    const drawer = page.getByRole('dialog', { name: 'القائمة' });
    await expect(drawer.getByRole('link')).toHaveCount(6);
    await expect(drawer.getByText('حساب مقبول')).toBeVisible();
    await drawer.getByRole('link', { name: /^عروضنا المقدمة/ }).click();
    await expect(page).toHaveURL('/company/offers');
    await expect(drawer).toBeHidden();
  } else {
    const box = (await sidebar.boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(page.viewportSize()!.width - 2); // the right edge
    await expect(page.getByText('حساب مقبول')).toBeVisible();
    await expect(sidebar.getByText('مرحال جو — بوابة الشركات الشريكة')).toBeVisible();
    // badges: requests without our offer, offers under review, inquiries awaiting reply
    await expect(sidebar.getByRole('link', { name: /استفسارات العملاء 6 / })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /الطلبات المتاحة \d+ / })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /عروضنا المقدمة \d+ / })).toBeVisible();
    await expect(sidebar.getByText(USER.email)).toBeVisible(); // the login email
  }
});

for (const lang of ['ar', 'en'] as const) {
  test(`every section fits the screen (${lang}); Back on every section but Overview`, async ({
    page,
  }) => {
    await setLanguage(page, lang);
    for (const section of SECTIONS) {
      await page.goto(`/company/${section}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
      const back = page.getByRole('button', {
        name: lang === 'ar' ? 'رجوع إلى الصفحة السابقة' : 'Back to the previous page',
      });
      await expect(back).toHaveCount(section === 'overview' ? 0 : 1);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    }
  });
}

/** Opens a section inside the app (sidebar on desktop, the drawer on mobile). */
async function openSection(page: Page, isMobile: boolean, name: RegExp) {
  if (isMobile) {
    await page.getByRole('button', { name: 'Open the menu' }).click();
    await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name }).click();
  } else {
    await page.locator('aside').getByRole('link', { name }).click();
  }
}

test('Back returns to the previous section, else Overview; customer URLs bounce back', async ({
  page,
  isMobile,
}) => {
  await setLanguage(page, 'en');
  await page.goto('/company/inquiries');
  await page.getByRole('button', { name: 'Back to the previous page' }).click();
  await expect(page).toHaveURL('/company/overview', { timeout: 15_000 }); // opened directly

  await openSection(page, isMobile, /^Available requests/);
  await expect(page).toHaveURL('/company/requests');
  await openSection(page, isMobile, /^Account settings/);
  await expect(page).toHaveURL('/company/settings');
  await page.getByRole('button', { name: 'Back to the previous page' }).click();
  await expect(page).toHaveURL('/company/requests');

  await page.goto('/app/orders');
  await expect(page).toHaveURL('/company/overview', { timeout: 15_000 });
});
