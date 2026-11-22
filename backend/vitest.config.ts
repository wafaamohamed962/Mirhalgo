import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Fake values: tests never reach Supabase or SMTP (those modules are mocked).
    env: {
      NODE_ENV: 'test',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-not-real',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '465',
      SMTP_USER: 'sender@example.com',
      SMTP_PASS: 'not-a-real-password',
      CONTACT_TO: 'team@example.com',
      OTP_PEPPER: 'test-pepper-0123456789abcdef0123456789abcdef',
      CORS_ORIGINS: 'http://localhost:5173',
    },
  },
});
