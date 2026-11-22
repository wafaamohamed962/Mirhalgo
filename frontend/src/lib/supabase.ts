import { createClient } from '@supabase/supabase-js';
import { assertConfigured, env, missingSupabaseEnv } from './env';

// Fails with a ConfigError (caught by AuthProvider) instead of supabase-js's crash.
assertConfigured(missingSupabaseEnv);

/**
 * Browser Supabase client: ANON key only (spec section 5), used for the session
 * and for reading the user's own profile (RLS). Sessions persist in localStorage
 * and refresh automatically, so users stay logged in until they log out (spec 4.5).
 */
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // we never use Supabase magic links / OAuth redirects
    storageKey: 'mirhalgo.auth',
  },
});
