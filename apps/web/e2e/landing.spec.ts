import { expect, test } from '@playwright/test';
import { fail, mockApi, ok, setLanguage } from './mocks';

test.describe('landing page', () => {
  test('Arabic by default (RTL) and switches to English (LTR)', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('اشحن أي حاجة لأي مكان');
    await expect(page).toHaveTitle(/مرحال جو/);

    if (isMobile) await page.getByRole('button', { name: 'فتح القائمة' }).click();
    await page.getByRole('button', { name: 'Switch to English' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ship anything, anywhere');
  });

  test('no horizontal overflow (responsive 360 → 1920)', async ({ page }) => {
    for (const language of ['ar', 'en'] as const) {
      await setLanguage(page, language);
      await page.goto('/');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `overflow in ${language}`).toBeLessThanOrEqual(0);
    }
  });

  test('navbar links scroll to sections and highlight', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop navbar');
    await setLanguage(page, 'en');
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await nav.getByRole('link', { name: 'Services' }).click();
    await expect(page.locator('#services')).toBeInViewport();
    await expect(nav.getByRole('link', { name: 'Services' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  test('mobile drawer opens, navigates and closes', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await setLanguage(page, 'en');
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const drawer = page.getByRole('dialog', { name: 'Main navigation' });
    await expect(drawer).toBeVisible();
    await drawer.getByRole('link', { name: 'Contact Us' }).click();
    await expect(drawer).toBeHidden();
    await expect(page.locator('#contact')).toBeInViewport();
  });

  test('social links: Facebook + WhatsApp open in a new tab, Instagram is inactive', async ({
    page,
  }) => {
    await setLanguage(page, 'en');
    await page.goto('/');
    const contact = page.locator('#contact');
    const facebook = contact.getByRole('link', { name: /Facebook/ });
    await expect(facebook).toHaveAttribute('href', 'https://www.facebook.com/share/1Co23xssyX/');
    await expect(facebook).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(facebook).toHaveAttribute('target', '_blank');
    await expect(contact.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
      'href',
      'https://wa.me/201207240825',
    );
    await expect(contact.getByRole('link', { name: /Instagram/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  test('footer year is the current year', async ({ page }) => {
    await setLanguage(page, 'en');
    await page.goto('/');
    await expect(page.locator('footer')).toContainText(`© ${new Date().getFullYear()} MirhalGo`);
  });

  test('contact form: validation, success toast and reset', async ({ page }) => {
    await setLanguage(page, 'en');
    const calls = await mockApi(page, { '/contact': () => ({ status: 201, body: ok(null) }) });
    await page.goto('/#contact');
    const form = page.locator('#contact form');

    await form.getByRole('button', { name: 'Send message' }).click();
    await expect(form.getByLabel('First name')).toHaveAttribute('aria-invalid', 'true');

    await form.getByLabel('First name').fill('Ali');
    await form.getByLabel('Last name').fill('Omar');
    await form.getByLabel('Email').fill('ali@example.com');
    await form.getByLabel('Phone').fill('01012345678');
    await form.getByLabel('Message').fill('I need a quote for sea freight.');
    await form.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByText('Thank you! Your message has been sent.')).toBeVisible();
    await expect(form.getByLabel('First name')).toHaveValue('');
    expect(calls[0]?.body).toMatchObject({ phone: '+201012345678', website: '' });
  });

  test('contact form shows the rate-limit error', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockApi(page, { '/contact': () => ({ status: 429, body: fail('RATE_LIMITED') }) });
    await page.goto('/#contact');
    const form = page.locator('#contact form');
    await form.getByLabel('First name').fill('Ali');
    await form.getByLabel('Last name').fill('Omar');
    await form.getByLabel('Email').fill('ali@example.com');
    await form.getByLabel('Phone').fill('01012345678');
    await form.getByLabel('Message').fill('Hello there, testing.');
    await form.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText('Too many requests. Please try again later.')).toBeVisible();
  });

  test('hero routes animation is decorative, never blocks CTAs, respects reduced motion', async ({
    page,
    isMobile,
  }) => {
    await setLanguage(page, 'en');
    await page.goto('/');
    const routes = page.locator('#top svg[viewBox="0 0 1440 900"]');
    await expect(routes).toHaveAttribute('aria-hidden', 'true');
    await expect(routes).toHaveCSS('pointer-events', 'none');
    const firstPath = routes.locator('path').first();
    // animated on tablet/desktop only; static on small screens (performance)
    await expect(firstPath).toHaveCSS('animation-name', isMobile ? 'none' : 'route-dash');
    await page.getByRole('link', { name: 'Get Started' }).click();
    await expect(page).toHaveURL('/signup');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(firstPath).toHaveCSS('animation-name', 'none');
  });

  test('responsive images: AVIF/WebP srcset, hero eager + high priority, others lazy', async ({
    page,
  }) => {
    await page.goto('/');
    const hero = page.locator('#top picture');
    await expect(hero.locator('source[type="image/avif"]')).toHaveAttribute(
      'srcset',
      /hero-640\.avif 640w.*hero-3840\.avif 3840w/,
    );
    await expect(hero.locator('img')).toHaveAttribute('loading', 'eager');
    await expect(hero.locator('img')).toHaveAttribute('fetchpriority', 'high');
    for (const img of await page.locator('#about img, #services img').all()) {
      await expect(img).toHaveAttribute('loading', 'lazy');
      await expect(img).not.toHaveAttribute('alt', '');
    }
    await expect(page.locator('#services img')).toHaveCount(3);
  });
});
