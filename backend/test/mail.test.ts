import { describe, expect, it, vi } from 'vitest';
import { escapeHtml } from '../src/services/mail/escape.js';
import { contactEmail, otpEmail } from '../src/services/mail/templates.js';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<script>alert("x")</script>&'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;',
    );
  });
});

describe('otpEmail', () => {
  it.each(['signup', 'reset_password'] as const)(
    '%s: code in body, never in subject',
    (purpose) => {
      const mail = otpEmail('482913', purpose);
      expect(mail.subject).not.toContain('482913');
      expect(mail.html).toContain('482913');
      expect(mail.text).toContain('482913');
    },
  );

  it('is bilingual with expiry and the ignore notice', () => {
    const { html } = otpEmail('482913', 'signup');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('10 minutes');
    expect(html).toContain("If you didn't request this, ignore this email.");
  });
});

describe('contactEmail', () => {
  it('escapes all user content (no HTML injection)', () => {
    const mail = contactEmail({
      firstName: 'Ali',
      lastName: 'Omar',
      email: 'a@b.co',
      phone: '+201012345678',
      message: '<img src=x onerror=alert(1)> hello there',
    });
    expect(mail.html).not.toContain('<img src=x');
    expect(mail.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(mail.subject).toBe('New contact message — Ali Omar');
  });
});

describe('SMTP_PASS not set', () => {
  it('email steps fail with MAIL_NOT_CONFIGURED instead of crashing', async () => {
    vi.resetModules();
    vi.stubEnv('SMTP_PASS', '');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { assertMailConfigured, mail, verifyMailTransport } =
      await import('../src/services/mail/index.js');
    expect(() => assertMailConfigured()).toThrow(
      expect.objectContaining({ code: 'MAIL_NOT_CONFIGURED', status: 503 }),
    );
    await expect(mail.otp('a@b.co', '123456', 'signup')).rejects.toMatchObject({
      code: 'MAIL_NOT_CONFIGURED',
    });
    expect(() => verifyMailTransport()).not.toThrow();
    vi.unstubAllEnvs();
  });
});
