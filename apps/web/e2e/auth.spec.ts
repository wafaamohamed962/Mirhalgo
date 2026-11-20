import { expect, test, type Page } from '@playwright/test';
import { fail, loginSuccess, mockApi, mockSupabase, ok, otpSent, USER, setLanguage } from './mocks';

const PASSWORD = 'Str0ng!pass';

async function fillCode(page: Page, code: string) {
  await page.getByRole('group').getByRole('textbox').first().click();
  await page.keyboard.type(code);
}

test.beforeEach(async ({ page }) => {
  await setLanguage(page, 'en');
  await mockSupabase(page);
});

test('customer sign up → OTP → logged in → dashboard → logout', async ({ page }) => {
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

  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome, Ali!' })).toBeVisible();
  expect(calls.find((c) => c.path === '/auth/login')?.body).toEqual({
    identifier: USER.email,
    password: PASSWORD,
  });

  // session persists across reloads (supabase-js persistSession)
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome, Ali!' })).toBeVisible();

  // logged-in users visiting /login go to the dashboard
  await page.goto('/login');
  await expect(page).toHaveURL('/dashboard');

  await page.getByRole('button', { name: 'Log out' }).click();
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
  });

  await page.goto('/login');
  await page.getByLabel('Email or phone').fill('01012345678');
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid email/phone or password');

  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL('/dashboard');
  expect(calls.at(-1)?.body.identifier).toBe('01012345678');
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
  await expect(page).toHaveURL('/login');
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

test('company sign up shows "Coming soon"', async ({ page }) => {
  await page.goto('/signup');
  await page.getByRole('link', { name: /Join as a Shipping Company/ }).click();
  await expect(page.getByRole('heading', { name: 'Coming soon' })).toBeVisible();
});

test('unknown route shows the 404 page', async ({ page }) => {
  await page.goto('/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('Arabic auth pages are RTL', async ({ page }) => {
  await setLanguage(page, 'ar');
  await page.goto('/login');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('أهلاً بيك تاني');
});
