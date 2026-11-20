import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { SessionTokens } from '@mirhalgo/shared';
import { ConfigError } from '../../lib/env';
import { AuthContext, type AuthContextValue } from './authContext';

/**
 * supabase-js is loaded after the first paint (its own chunk) to keep the initial
 * bundle small for Lighthouse (spec 8.5). Guards wait for `loading` to finish.
 */
const loadSupabase = () => import('../../lib/supabase').then((module) => module.supabase);

/** Session state for the whole app (spec 4.5), kept in sync with supabase-js. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    loadSupabase()
      .then(async (supabase) => {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        setSession(data.session);
        const listener = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
        unsubscribe = () => listener.data.subscription.unsubscribe();
      })
      .catch((error: unknown) => {
        // Missing config is reported once at startup (lib/env.ts); anything else is a bug.
        if (!(error instanceof ConfigError)) console.error(error);
      })
      // Never leave guards spinning: without Supabase the visitor is simply logged out.
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  /** Stores the tokens returned by POST /api/auth/login (spec 4.4). */
  const signIn = useCallback(async (tokens: SessionTokens) => {
    const supabase = await loadSupabase();
    const { data, error } = await supabase.auth.setSession(tokens);
    if (error) throw error;
    // set now (not only via onAuthStateChange) so guards see it before the next navigation
    setSession(data.session);
    setSignedOut(false);
  }, []);

  const signOut = useCallback(async () => {
    const supabase = await loadSupabase();
    await supabase.auth.signOut();
    setSignedOut(true); // spec 4.5: logout → `/` (ProtectedRoute uses this)
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      isVerified: Boolean(session?.user.email_confirmed_at),
      signIn,
      signOut,
      signedOut,
    }),
    [session, loading, signIn, signOut, signedOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
