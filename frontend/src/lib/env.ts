/**
 * Public build-time configuration (spec 8.6). Missing values must never crash the app:
 * the landing page and navigation keep working, and only the features that need
 * Supabase or the API show a translated "not available" error (errors.CONFIG_MISSING).
 */
import { isSupabaseProjectUrl } from '@mirhalgo/shared';

type PublicEnvKey = 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY' | 'VITE_API_URL';

// Static property access so Vite can inline the values at build time.
const values: Record<PublicEnvKey, string | undefined> = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_API_URL: import.meta.env.VITE_API_URL,
};

const isUsable = (key: PublicEnvKey) => {
  const value = values[key]?.trim();
  if (!value) return false;
  // A REST URL (…/rest/v1/) breaks every Supabase call: treat it like a missing value.
  return key !== 'VITE_SUPABASE_URL' || isSupabaseProjectUrl(value);
};

/** Keys that are missing or invalid. */
const missing = (keys: PublicEnvKey[]) => keys.filter((key) => !isUsable(key));

/** Needed by the session (AuthProvider) and the dashboard. */
export const missingSupabaseEnv = missing(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']);
/** Needed by every form that calls the API (auth pages, contact form). */
export const missingApiEnv = missing(['VITE_API_URL']);

export const env = {
  supabaseUrl: values.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: values.VITE_SUPABASE_ANON_KEY ?? '',
  apiUrl: (values.VITE_API_URL ?? '').replace(/\/$/, ''),
};

/** Thrown when a feature is used while its configuration is missing. */
export class ConfigError extends Error {
  constructor(public readonly missingKeys: string[]) {
    super(`Missing environment variable(s): ${missingKeys.join(', ')}`);
    this.name = 'ConfigError';
  }
}

export function assertConfigured(missingKeys: string[]) {
  if (missingKeys.length > 0) throw new ConfigError(missingKeys);
}

/**
 * Feature flags (MW_002 decisions 17 + 18). Customer portal data comes from MSW mocks until
 * the real API exists; company names in the directory can be hidden with one switch.
 */
export const flags = {
  useMocks: import.meta.env.VITE_USE_MOCKS === 'true',
  showCompanyIdentity: import.meta.env.VITE_SHOW_COMPANY_IDENTITY !== 'false',
  /**
   * Company portal demo tools (MW_004 spec B1/B9, plan Q11): "Reset demo data" and the
   * suspension switch. Development, or a staging / preview build with VITE_DEMO_TOOLS=true;
   * never in a production build without it.
   */
  demoTools: import.meta.env.DEV || import.meta.env.VITE_DEMO_TOOLS === 'true',
};

/** One clear console message at startup naming every missing variable. */
export function reportMissingEnv() {
  const all = [...missingSupabaseEnv, ...missingApiEnv];
  if (all.length === 0) return;
  console.error(
    `[MirhalGo] Missing or invalid environment variable(s): ${all.join(', ')}. ` +
      'Copy .env.example to frontend/.env, fill them in (VITE_SUPABASE_URL = project URL only, ' +
      'no /rest/v1) and restart the dev server. ' +
      'Until then sign up, login and the contact form are unavailable.',
  );
}
