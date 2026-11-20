import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { SessionTokens } from '@mirhalgo/shared';

export type AuthContextValue = {
  session: Session | null;
  /** True until the stored session has been read on startup. */
  loading: boolean;
  /** Session exists and its email is confirmed (required for /dashboard). */
  isVerified: boolean;
  signIn: (tokens: SessionTokens) => Promise<void>;
  signOut: () => Promise<void>;
  /** True after the user logged out in this tab: guards send them to `/`, not `/login`. */
  signedOut: boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
