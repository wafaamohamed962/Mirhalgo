import { expect, test, type Page } from '@playwright/test';
import { mockMeApi, mockSupabase, seedSession, setLanguage } from './mocks';

/*
 * Company portal flows (MW_004 B11) on the build with the MSW mocks on (+ demo tools, like the
 * preview). Every /api/company/* response the browser receives is kept and checked for
 * privacy: no client contact data, no competitor name / id / alias.
 */

// fixtures (src/mocks/company/fixtures.ts): the fictional clients and competitors
const CLIENT_VALUES = [
  'منى عبد الرحمن',
  'كريم حسن',
  'سارة محمود',
  'أحمد يوسف',
  '+201011112222',
  'مؤسسة الأمل للتجارة',
];
const COMPETITOR_VALUES = [
  'co_nile',
  'co_delta',
  'co_sky',
  'co_red',
  'co_east',
  'النيل للشحن البحري',
  'دلتا للنقل البري',
  'السماء للشحن الجوي',
  'البحر الأحمر للخدمات اللوجستية',
  'الشرق للتجارة والشحن',
];

/** Bodies of every company API response (MSW answers through the service worker). */
function recordCompanyResponses(page: Page) {
  const bodies: string[] = [];
  page.on('response', (response) => {
    if (!response.url().includes('/api/company/')) return;
    void response.text().then(
      (text) => bodies.push(text),
      () => {},
    );
  });
  return bodies;
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.beforeEach(async ({ page }) => {
  await seedSession(page, 'company');
  await mockSupabase(page, 'company', 'approved');
  await mockMeApi(page, 'company', 'approved');
});

test('submit an offer → offers, badges and the log follow; it survives a reload; Reset demo data', async ({
  page,
}) => {
  test.slow(); // the longest company flow (~14 s alone): past the 30 s default under the full run
  const bodies = recordCompanyResponses(page);
  await setLanguage(page, 'en');
  await page.goto('/company/requests?search=Domestic%20land');
  const submit = page.getByRole('button', { name: /^Submit (additional )?offer — MG\d+$/ }).first();
  await expect(submit).toBeVisible({ timeout: 15_000 });
  const id = (await submit.getAttribute('aria-label'))!.match(/MG\d+/)![0];

  // the details modal first: the privacy notice, no contact data
  await page.getByRole('button', { name: `Details of request ${id}` }).click();
  const details = page.getByRole('dialog', { name: `Request ${id} details` });
  await expect(details.getByText(/contact details are hidden/)).toBeVisible();
  await expect(details.getByRole('heading', { name: 'Cargo' })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await details.getByRole('button', { name: /^Submit (additional )?offer$/ }).click();

  const form = page.getByRole('dialog', { name: `Submit an offer on request ${id}` });
  await form.getByRole('button', { name: 'Send offer' }).click();
  await expect(form.getByText('This field is required')).toBeVisible();
  await form.getByLabel(/Amount in Egyptian pounds/).fill('٧٥٠٠');
  await form.getByLabel('Transit time').fill('2');
  await form.getByRole('button', { name: 'Send offer' }).click();
  await expect(page.getByText(/was sent and is now under review/)).toBeVisible();
  await expect(form).toBeHidden();

  // our offers: the new one, with its total; it survives a reload (persisted per account)
  await page.goto(`/company/offers?search=${id}`);
  await expect(page.getByText('7,500 EGP').first()).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.getByText('7,500 EGP').first()).toBeVisible({ timeout: 15_000 });

  // the overview log
  await page.goto('/company/overview');
  const activity = page.getByRole('region', { name: 'Recent account activity' });
  // newest first: our new offer is the top entry
  await expect(activity.getByRole('listitem').first()).toContainText(
    `was submitted on request ${id}`,
    {
      timeout: 15_000,
    },
  );

  // Reset demo data (dev / staging): back to the fixtures
  await page.goto('/company/settings');
  const demo = page.getByRole('region', { name: 'Demo tools' });
  await demo.getByRole('button', { name: 'Reset demo data' }).click();
  await page
    .getByRole('dialog', { name: 'Reset the demo data?' })
    .getByRole('button', { name: 'Reset demo data' })
    .click();
  await expect(page.getByText('The demo data was reset.')).toBeVisible();
  await page.goto(`/company/offers?search=${id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('7,500 EGP')).toHaveCount(0);

  // privacy over everything the API sent
  expect(bodies.length).toBeGreaterThan(5);
  for (const body of bodies) {
    for (const value of [...CLIENT_VALUES, ...COMPETITOR_VALUES]) expect(body).not.toContain(value);
  }
});

test('Arabic: comparison shows competitors as numbers; an inquiry reply is final', async ({
  page,
}) => {
  const bodies = recordCompanyResponses(page);
  await page.goto('/company/competitors');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const compare = page.getByRole('button', { name: /^مقارنة الأسعار على الطلب MG\d+$/ }).first();
  await expect(compare).toBeVisible({ timeout: 15_000 });
  await compare.click();
  const comparison = page.getByRole('dialog', { name: /^مقارنة الأسعار — الطلب/ });
  await expect(comparison.getByText(/^الشركة المنافسة رقم \d+$/).first()).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await page.keyboard.press('Escape');

  await page.goto('/company/inquiries?status=awaiting_reply');
  const open = page.getByRole('button', { name: /^فتح الاستفسار IQ-\d+$/ }).first();
  await expect(open).toBeVisible({ timeout: 15_000 });
  await open.click();
  const inquiry = page.getByRole('dialog', { name: /^الاستفسار IQ-/ });
  await inquiry.getByLabel(/^الرد/).fill('نعم، يشمل السعر التخليص الجمركي في ميناء الوصول.');
  await inquiry.getByRole('button', { name: 'إرسال الرد' }).click();
  await expect(inquiry.getByText('ردنا')).toBeVisible();
  await expect(inquiry.getByRole('button', { name: 'إرسال الرد' })).toHaveCount(0);
  await expect(inquiry.getByText(/^أُرسل في /)).toBeVisible();

  for (const body of bodies) {
    for (const value of [...CLIENT_VALUES, ...COMPETITOR_VALUES]) expect(body).not.toContain(value);
  }
});

test('suspension (demo switch): Submit offer is disabled with an explanation everywhere', async ({
  page,
}) => {
  await setLanguage(page, 'en');
  await page.goto('/company/settings');
  const demo = page.getByRole('region', { name: 'Demo tools' });
  // the switch's checkbox is visually hidden: people click its label
  await demo.getByText('Simulate a suspension of offer submission').click({ timeout: 15_000 });
  await expect(
    page.getByRole('region', { name: 'Offer submission status' }).getByText('Suspended'),
  ).toBeVisible();

  await page.goto('/company/requests');
  await expect(page.getByText(/suspended offer submission for your account/)).toBeVisible({
    timeout: 15_000,
  });
  const buttons = page.getByRole('button', { name: /^Submit (additional )?offer — / });
  expect(await buttons.count()).toBeGreaterThan(0);
  for (const button of await buttons.all()) await expect(button).toBeDisabled();
});
