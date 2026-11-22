import { describe, expect, it } from 'vitest';
import { isSupabaseProjectUrl } from '../src/env.js';

// Regression: SUPABASE_URL ending in /rest/v1/ made forgot-password fail with PGRST125.
describe('isSupabaseProjectUrl', () => {
  it.each([
    'https://wpcpxmwkihaismxbdxip.supabase.co',
    'https://wpcpxmwkihaismxbdxip.supabase.co/',
    'http://127.0.0.1:54321',
  ])('accepts the bare project URL %s', (url) => {
    expect(isSupabaseProjectUrl(url)).toBe(true);
  });

  it.each([
    'https://wpcpxmwkihaismxbdxip.supabase.co/rest/v1/',
    'https://wpcpxmwkihaismxbdxip.supabase.co/rest/v1',
    'https://wpcpxmwkihaismxbdxip.supabase.co/auth/v1',
    'https://wpcpxmwkihaismxbdxip.supabase.co?x=1',
    'ftp://wpcpxmwkihaismxbdxip.supabase.co',
    'not a url',
    '',
  ])('rejects %s', (url) => {
    expect(isSupabaseProjectUrl(url)).toBe(false);
  });
});
