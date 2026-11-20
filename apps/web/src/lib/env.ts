/**
 * Public build-time configuration (spec 8.6). Missing values must never crash the app:
 * the landing page and navigation keep working, and only the features that need
 * Supabase or the API show a translated "not available" error (errors.CONFIG_MISSING).
 */
type PublicEnvKey = 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY' | 'VITE_API_URL';

// Static property access so Vite can inline the values at build time.
const values: Record<PublicEnvKey, string | undefined> = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_API_URL: import.meta.env.VITE_API_URL,
};

const missing = (keys: PublicEnvKey[]) => keys.filter((key) => !values[key]?.trim());

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

/** One clear console message at startup naming every missing variable. */
export function reportMissingEnv() {
  const all = [...missingSupabaseEnv, ...missingApiEnv];
  if (all.length === 0) return;
  console.error(
    `[MirhalGo] Missing environment variable(s): ${all.join(', ')}. ` +
      'Copy .env.example to apps/web/.env, fill them in and restart the dev server. ' +
      'Until then sign up, login and the contact form are unavailable.',
  );
}
