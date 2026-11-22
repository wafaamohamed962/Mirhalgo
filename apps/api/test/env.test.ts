import { describe, expect, it } from 'vitest';
import { envSchema } from '../src/schemas/env.js';

/*
 * Regression: with SUPABASE_URL = https://<ref>.supabase.co/rest/v1/ every PostgREST call
 * went to /rest/v1/rest/v1/<table> (forgot-password → 500 PGRST125) and every sign-in to
 * /rest/v1/auth/v1/token (login always "invalid credentials"). The API must refuse to start.
 */
const valid = { ...process.env }; // the fake test env from vitest.config.ts

describe('envSchema SUPABASE_URL', () => {
  it('accepts the bare project URL', () => {
    expect(envSchema.safeParse(valid).success).toBe(true);
  });

  it.each(['https://example.supabase.co/rest/v1/', 'https://example.supabase.co/rest/v1'])(
    'rejects the REST URL %s',
    (url) => {
      const parsed = envSchema.safeParse({ ...valid, SUPABASE_URL: url });
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]?.path).toEqual(['SUPABASE_URL']);
      expect(parsed.error?.issues[0]?.message).toMatch(/no \/rest\/v1/);
    },
  );
});
