import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { CompanyStatus, SessionTokens, UserRole } from '@mirhalgo/shared';

export type AuthContextValue = {
  session: Session | null;
  /**
   * True until the stored session has been read on startup, and, for a company, until its
   * application status is known (MW_004 A1: routing depends on it).
   */
  loading: boolean;
  /** Session exists and its email is confirmed (required for /dashboard). */
  isVerified: boolean;
  /** From the JWT; null when logged out (or a token without a role). */
  role: UserRole | null;
  /** A company's application status (GET /api/me or the login response); else null. */
  companyStatus: CompanyStatus | null;
  /** Stores the session; `companyStatus` from the login response saves a GET /api/me. */
  signIn: (tokens: SessionTokens, companyStatus?: CompanyStatus | null) => Promise<void>;
  signOut: () => Promise<void>;
  /** True after the user logged out in this tab: guards send them to `/`, not `/login`. */
  signedOut: boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
