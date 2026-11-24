import { expect, test, type Page } from '@playwright/test';
import {
  fail,
  loginAs,
  loginSuccess,
  me,
  meAs,
  mockApi,
  mockSupabase,
  ok,
  otpSent,
  seedSession,
  USER,
  setLanguage,
  summary,
} from './mocks';

const PASSWORD = 'Str0ng!pass';

async function fillCode(page: Page, code: string) {
  await page.getByRole('group').getByRole('textbox').first().click();
  await page.keyboard.type(code);
}

test.beforeEach(async ({ page }) => {
  await setLanguage(page, 'en');
  await mockSupabase(page);
});

test('customer sign up → OTP → logged in → customer portal → logout', async ({ page }) => {
  const calls = await mockApi(page, {
    '/auth/signup': (body) => ({
      status: 201,
      body: ok({ email: body.email, cooldownSeconds: 60 }),
    }),
    '/auth/verify-email': (body) =>
      body.code === '123456'
        ? { status: 200, body: ok({ verified: true }) }
        : { status: 400, body: fail('OTP_INVALID') },
    '/auth/login': loginSuccess,
    '/me/avatar': me,
    '/me/summary': summary,
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started' }).click();
  await page.getByRole('link', { name: /Sign up as a Customer/ }).click();
  await expect(page).toHaveURL('/signup/customer');

  await page.getByLabel('First name').fill('Ali');
  await page.getByLabel('Last name').fill('Omar');
  await page.getByLabel('Email').fill(USER.email);
  await page.getByLabel('Phone').fill('1012345678');
  await page.getByLabel('Gender').selectOption('male');
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL('/verify-email');
  await expect(page.getByText(USER.email)).toBeVisible();
  await expect(page.getByRole('button', { name: /Resend code in/ })).toBeDisabled();

  await fillCode(page, '000000'); // wrong code → error, boxes cleared
  await expect(page.getByText('The code is incorrect.')).toBeVisible();
  await fillCode(page, '123456'); // auto-submits when complete

  await expect(page).toHaveURL('/app/new-request');
  await expect(page.getByRole('heading', { name: 'Welcome, Ali' })).toBeVisible();
  expect(calls.find((c) => c.path === '/auth/login')?.body).toEqual({
    identifier: USER.email,
    password: PASSWORD,
  });

  // session persists across reloads (supabase-js persistSession)
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome, Ali' })).toBeVisible();

  // logged-in users visiting /login (or the MW_001 /dashboard URL) go to their home
  await page.goto('/login');
  await expect(page).toHaveURL('/app/new-request');
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/app/new-request');

  await page.getByRole('button', { name: /Account menu/ }).click();
  await page.locator('[data-popover-panel]').getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/login');
});

test('login with phone; errors are generic', async ({ page }) => {
  const calls = await mockApi(page, {
    '/auth/login': (body) =>
      body.password === PASSWORD
        ? loginSuccess(body)
        : { status: 401, body: fail('INVALID_CREDENTIALS') },
    '/me/avatar': me,
  });

  await page.goto('/login');
  await page.getByLabel('Email or phone').fill('01012345678');
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid email/phone or password');

  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL('/app/new-request');
  expect(
    calls.find((c) => c.path === '/auth/login' && c.body.password === PASSWORD)?.body.identifier,
  ).toBe('01012345678');
});

test('unverified login → fresh code → verify page', async ({ page }) => {
  await mockApi(page, {
    '/auth/login': () => ({
      status: 200,
      body: ok({ status: 'verification_required', email: USER.email }),
    }),
  });
  await page.goto('/login');
  await page.getByLabel('Email or phone').fill(USER.email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL('/verify-email');
  await expect(page.getByText('Please verify your email first.')).toBeVisible();
});

test('too many wrong attempts is reported', async ({ page }) => {
  await mockApi(page, {
    '/auth/signup': otpSent,
    '/auth/verify-email': () => ({ status: 429, body: fail('OTP_TOO_MANY_ATTEMPTS') }),
  });
  await page.addInitScript(() =>
    sessionStorage.setItem('mirhalgo.pendingEmail', 'ali@example.com'),
  );
  await page.goto('/verify-email');
  await fillCode(page, '999999');
  await expect(page.getByText('Too many wrong attempts. Request a new code.')).toBeVisible();
});

test('verify page without a pending signup redirects to /login', async ({ page }) => {
  await page.goto('/verify-email');
  // the guard waits for the session, read after lazy chunks: slow under parallel load
  await expect(page).toHaveURL('/login', { timeout: 15_000 });
});

test('forgot password end to end', async ({ page }) => {
  const calls = await mockApi(page, {
    '/auth/forgot-password': otpSent,
    '/auth/reset-password': () => ({ status: 200, body: ok(null) }),
  });

  await page.goto('/login');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  // wait for the lazy page: a loose 'Email' label also matches the login page's "Email or phone"
  await expect(page.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(USER.email);
  await page.getByRole('button', { name: 'Send code' }).click();

  await expect(
    page.getByText(`If an account exists, we sent a code to ${USER.email}.`),
  ).toBeVisible();
  await fillCode(page, '654321');
  await page.getByRole('textbox', { name: 'New password', exact: true }).fill('N3w!password');
  await page.getByLabel('Confirm new password').fill('N3w!password');
  await page.getByRole('button', { name: 'Reset password' }).click();

  await expect(page).toHaveURL('/login');
  await expect(page.getByText('Your password was updated. You can log in now.')).toBeVisible();
  expect(calls.at(-1)?.body).toMatchObject({ email: USER.email, code: '654321' });
});

test('company registration → OTP → "Application submitted" (no login)', async ({ page }) => {
  const calls = await mockApi(page, {
    '/companies/register': () => ({
      status: 201,
      body: ok({ email: 'ops@nile.com', cooldownSeconds: 60 }),
    }),
    '/auth/verify-email': () => ({
      status: 200,
      body: ok({
        verified: true,
        role: 'company',
        application: { referenceNumber: 'MG-C-2026-000042', status: 'pending_review' },
      }),
    }),
  });

  await page.goto('/signup');
  await page.getByRole('link', { name: /Join as a Shipping Company/ }).click();
  await expect(page).toHaveURL('/signup/company');

  // Step 1 ("Other" only → Services is skipped)
  await page.getByLabel(/Legal company name/).fill('Nile Shipping');
  await page.getByLabel(/Representative full name/).fill('Ahmed Hassan');
  await page.getByLabel(/Representative job title/).fill('Owner');
  await page.getByLabel(/Business email/).fill('ops@nile.com');
  await page.getByLabel(/Mobile phone/).fill('1012345678');
  await page.getByLabel(/^Country(?! code)/).selectOption('EG');
  await page.getByLabel(/^Governorate/).selectOption('EG-GZ');
  await page.getByLabel(/City \/ Area/).fill('Dokki');
  await page.getByLabel(/Street address/).fill('5 Tahrir Street');
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD);
  await page.getByLabel(/^Confirm password/).fill(PASSWORD);
  await page.getByText('Other', { exact: true }).click();
  await page.getByLabel(/Describe the other activity/).fill('Warehousing');
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 3: a renamed EXE is refused by content, real PDFs are accepted
  await page.getByLabel(/Commercial register number/).fill('123');
  await page.getByLabel(/Tax card number/).fill('123456789');
  await expect(page.getByLabel(/Tax card number/)).toHaveValue('123-456-789');
  const register = page.getByLabel(/Commercial register copy/);
  await register.setInputFiles({
    name: 'cr.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('MZ fake'),
  });
  await expect(page.getByText('Upload a PDF, JPG or PNG file')).toBeVisible();
  await register.setInputFiles({
    name: 'cr.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7'),
  });
  await page.getByLabel(/Tax card copy/).setInputFiles({
    name: 'tax.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4'),
  });
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 4: review + confirmations
  await expect(page.getByText('Nile Shipping')).toBeVisible();
  await page.getByLabel(/I confirm that all information/).check();
  await page.getByLabel(/I agree to the Terms/).check();
  await page.getByRole('button', { name: 'Submit application' }).click();

  await expect(page).toHaveURL('/verify-email');
  const sent = calls.find((c) => c.path === '/companies/register')!.raw;
  expect(sent).toContain('name="application"');
  expect(sent).toContain('filename="cr.pdf"');
  expect(sent).toContain('filename="tax.pdf"');
  await expect(page.getByRole('link', { name: /Start the registration again/ })).toBeVisible();

  await fillCode(page, '123456');
  await expect(page).toHaveURL('/signup/company/submitted');
  await expect(page.getByRole('heading', { name: 'Application submitted' })).toBeVisible();
  await expect(page.getByText('MG-C-2026-000042')).toBeVisible();
  await expect(page.getByText('Pending review')).toBeVisible();
  expect(calls.some((c) => c.path === '/auth/login')).toBe(false); // decision 6
});

test('unknown route shows the 404 page', async ({ page }) => {
  await page.goto('/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('Arabic auth pages are RTL', async ({ page }) => {
  await setLanguage(page, 'ar');
  await page.goto('/login');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('مرحبًا بعودتك');
});

test('"Back to home" on both sign-up forms: fits the header, confirms when the form has data', async ({
  page,
}) => {
  await mockApi(page, {});
  for (const [path, field] of [
    ['/signup/customer', /First name/],
    ['/signup/company', /Legal company name/],
  ] as const) {
    for (const language of ['ar', 'en'] as const) {
      await setLanguage(page, language);
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `${path} ${language}`).toBeLessThanOrEqual(0);
    }

    // empty form: straight home
    await page.getByRole('link', { name: 'Back to home' }).click();
    await expect(page).toHaveURL('/');

    // with data: confirm first
    await page.goto(path);
    await page.getByLabel(field).fill('Nile');
    await page.getByRole('link', { name: 'Back to home' }).click();
    const dialog = page.getByRole('dialog', { name: 'Leave the form?' });
    await dialog.getByRole('button', { name: 'Stay' }).click();
    await expect(page).toHaveURL(path);
    await page.getByRole('link', { name: 'Back to home' }).click();
    await dialog.getByRole('button', { name: 'Leave' }).click();
    await expect(page).toHaveURL('/');
  }
});

test('"Back" on the auth pages: under the header, previous page or home, start side in RTL', async ({
  page,
  isMobile,
}) => {
  await mockApi(page, {});
  const back = (name: string) => page.getByRole('button', { name });

  // reached inside the app → the previous page
  await page.goto('/');
  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
  await page
    .getByRole('link', { name: 'Login', exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page).toHaveURL('/login');
  await back('Back to the previous page').click();
  await expect(page).toHaveURL('/');

  // opened directly (an email link, a new tab) → home
  for (const path of ['/forgot-password', '/signup', '/signup/customer', '/signup/company']) {
    await page.goto(path);
    await back('Back to the previous page').click();
    await expect(page, path).toHaveURL('/');
  }

  // Arabic: "رجوع" under the header, on the start (right) side; A3 "Back to home" stays
  await setLanguage(page, 'ar');
  await page.goto('/signup/company');
  const button = back('رجوع إلى الصفحة السابقة');
  await expect(button).toHaveText('رجوع');
  await expect(page.getByRole('link', { name: 'العودة إلى الرئيسية' })).toBeVisible();
  const header = (await page.locator('header').first().boundingBox())!;
  const box = (await button.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(box.x + box.width).toBeGreaterThan(page.viewportSize()!.width / 2);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('landing → login → portal: Back never returns to the login page', async ({
  page,
  isMobile,
}) => {
  await mockApi(page, { '/auth/login': loginSuccess, '/me/avatar': me, '/me/summary': summary });
  await page.goto('/');
  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
  await page
    .getByRole('link', { name: 'Login', exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByLabel('Email or phone').fill(USER.email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL('/app/new-request');

  // the login entry was replaced (and /app → /app/new-request too): Back is the landing page
  await page.goBack();
  await expect(page).toHaveURL('/');
});

test('a pending company opening a customer URL: its status page, and Back never offers a customer page', async ({
  page,
}) => {
  await seedSession(page, 'company');
  await mockSupabase(page, 'company');
  await mockApi(page, { '/me': meAs('company', 'pending_review') });

  // the role guard redirects (replace); opened directly, Back goes to a page a company can open
  await page.goto('/app/orders/ord_118');
  await expect(page).toHaveURL('/company/application-status', { timeout: 15_000 });
  await expect(page.getByText('Pending review')).toBeVisible();
  await page.getByRole('button', { name: 'Back to the previous page' }).click();
  await expect(page).toHaveURL('/');

  // a missing page → the company's home, in Arabic too
  await setLanguage(page, 'ar');
  await page.goto('/nowhere');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('button', { name: 'رجوع إلى الصفحة السابقة' }).click();
  await expect(page).toHaveURL('/company/application-status');

  // the MW_002 URL still works, and the portal stays closed while not approved
  await page.goto('/application-status');
  await expect(page).toHaveURL('/company/application-status', { timeout: 15_000 });
  await page.goto('/company/overview');
  await expect(page).toHaveURL('/company/application-status', { timeout: 15_000 });
});

/* MW_004 A1: one /login for everyone, routed by role and company status. */

async function logIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email or phone').fill(USER.email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
}

test('an approved company logs in from /login → Overview; customer URLs and the status page bounce; logout', async ({
  page,
  isMobile,
}) => {
  await mockSupabase(page, 'company', 'approved');
  await mockApi(page, {
    '/auth/login': loginAs('company', 'approved'),
    '/me': meAs('company', 'approved'),
  });
  await logIn(page);
  await expect(page).toHaveURL('/company/overview');
  // the login entry was replaced: Back does not return to /login
  await page.goBack();
  await expect(page).not.toHaveURL(/\/login/);

  for (const path of [
    '/app/new-request',
    '/company/application-status',
    '/company',
    '/dashboard',
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL('/company/overview', { timeout: 15_000 });
  }
  await page.goto('/company/offers');
  await expect(page).toHaveURL('/company/offers');

  // logout: in the sidebar (desktop) or the menu drawer (mobile, MW_004 B2)
  if (isMobile) await page.getByRole('button', { name: 'Open the menu' }).click();
  await page.getByRole('button', { name: 'Log out' }).filter({ visible: true }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/company/overview');
  await expect(page).toHaveURL('/login', { timeout: 15_000 });
});

for (const status of ['pending_review', 'changes_requested', 'rejected'] as const) {
  test(`a ${status} company logs in from /login → the application status page`, async ({
    page,
  }) => {
    await mockSupabase(page, 'company', status);
    await mockApi(page, {
      '/auth/login': loginAs('company', status),
      '/me': meAs('company', status),
    });
    await logIn(page);
    await expect(page).toHaveURL('/company/application-status');
  });
}

test('a customer opening a company URL lands on New Request', async ({ page }) => {
  await seedSession(page, 'customer');
  await mockApi(page, { '/me/avatar': me, '/me/summary': summary });
  await page.goto('/company/offers');
  await expect(page).toHaveURL('/app/new-request', { timeout: 15_000 });
});
