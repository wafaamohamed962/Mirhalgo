import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { CompanyStatus, SessionTokens } from '@mirhalgo/shared';
import { ConfigError } from '../../lib/env';
import { clearCompanyDraft } from '../companyRegistration/draft';
import { authApi } from './api';
import { AuthContext, type AuthContextValue } from './authContext';
import { roleOf } from './roles';

/**
 * supabase-js is loaded after the first paint (its own chunk) to keep the initial
 * bundle small for Lighthouse (spec 8.5). Guards wait for `loading` to finish.
 */
const loadSupabase = () => import('../../lib/supabase').then((module) => module.supabase);

/** A company's status, tagged with the account it belongs to (a new login must not reuse it). */
type KnownStatus = { userId: string; value: CompanyStatus | null };

/**
 * Session state for the whole app (spec 4.5), kept in sync with supabase-js. For a company
 * it also holds the application status (MW_004 A1): from the login response, or from
 * GET /api/me when an existing session is opened. Customers need no extra request.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [knownStatus, setKnownStatus] = useState<KnownStatus | null>(null);

  const role = roleOf(session);
  const isVerified = Boolean(session?.user.email_confirmed_at);
  const userId = session?.user.id ?? null;
  const needsStatus = role === 'company' && isVerified && userId !== null;
  const statusKnown = needsStatus && knownStatus?.userId === userId;

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

  // an existing company session (reload, new tab): ask the API once per account
  useEffect(() => {
    if (!needsStatus || statusKnown || !userId) return;
    let active = true;
    authApi
      .me()
      // unreachable API: unknown = not approved, so the company sees its status page
      .then(
        (me) => me.companyStatus,
        () => null,
      )
      .then((value) => active && setKnownStatus({ userId, value }));
    return () => {
      active = false;
    };
  }, [needsStatus, statusKnown, userId]);

  /** Stores the tokens returned by POST /api/auth/login (spec 4.4). */
  const signIn = useCallback(
    async (tokens: SessionTokens, companyStatus?: CompanyStatus | null) => {
      const supabase = await loadSupabase();
      const { data, error } = await supabase.auth.setSession(tokens);
      if (error) throw error;
      if (companyStatus !== undefined && data.session) {
        setKnownStatus({ userId: data.session.user.id, value: companyStatus });
      }
      // set now (not only via onAuthStateChange) so guards see it before the next navigation
      setSession(data.session);
      setSignedOut(false);
    },
    [],
  );

  const signOut = useCallback(async () => {
    const supabase = await loadSupabase();
    await supabase.auth.signOut();
    clearCompanyDraft(); // MW_002 decision 7
    setSignedOut(true); // spec 4.5: logout → `/` (ProtectedRoute uses this)
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading: loading || (needsStatus && !statusKnown),
      isVerified,
      role,
      companyStatus: statusKnown ? (knownStatus?.value ?? null) : null,
      signIn,
      signOut,
      signedOut,
    }),
    [
      session,
      loading,
      isVerified,
      role,
      needsStatus,
      statusKnown,
      knownStatus,
      signIn,
      signOut,
      signedOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
