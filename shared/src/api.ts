import type { ApplicationStatus, UserRole } from './company.js';

/** API response shape (spec section 7). */
export type ApiSuccess<T> = { ok: true; data: T };
export type ApiError = { ok: false; error: { code: ErrorCode; message: string } };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/**
 * Error codes returned by the API. UPPER_SNAKE_CASE and i18n-ready:
 * the web app translates them with the key `errors.<CODE>`.
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_CREDENTIALS',
  // company registration (MW_002): duplicate commercial register / tax number (decision 1),
  // then the upload errors (files are checked by real content on the server)
  'COMPANY_ALREADY_REGISTERED',
  'FILE_REQUIRED',
  'FILE_TYPE_NOT_ALLOWED',
  'FILE_TOO_LARGE',
  'TOO_MANY_FILES',
  'OTP_INVALID',
  'OTP_EXPIRED',
  'OTP_TOO_MANY_ATTEMPTS',
  'OTP_COOLDOWN',
  'RATE_LIMITED',
  'MAIL_FAILED',
  'MAIL_NOT_CONFIGURED',
  'CORS_NOT_ALLOWED',
  'PAYLOAD_TOO_LARGE',
  'INVALID_JSON',
  // authenticated endpoints (MW_003): no / expired session, or the wrong role
  // New Request orders (MW_003 B4): no requests left; an Idempotency-Key reused for another order
  'NO_BALANCE',
  'IDEMPOTENCY_KEY_REUSED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  // company portal (MW_004): offers blocked by the administration, an offer past review,
  // a request no longer open, an inquiry already answered (a reply is final)
  'OFFER_SUBMISSION_SUSPENDED',
  'OFFER_NOT_EDITABLE',
  'ORDER_NOT_OPEN',
  'INQUIRY_ALREADY_REPLIED',
  'INTERNAL',
  'NETWORK_ERROR',
  // client-side: a required VITE_* variable is missing (see frontend/src/lib/env.ts)
  'CONFIG_MISSING',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Session tokens returned by POST /api/auth/login (passed to supabase.auth.setSession). */
export type SessionTokens = { access_token: string; refresh_token: string };

/** Neutral result of every endpoint that (maybe) sends an OTP: signup, resend, forgot password. */
export type OtpSentResult = { email: string; cooldownSeconds: number };
/**
 * POST /api/auth/login. Correct password + unverified email → a fresh OTP was sent and
 * the client goes to /verify-email (spec 4.4). The email is returned because the user
 * may have logged in with their phone. `role` and `companyStatus` route the client
 * (MW_002 A6, MW_004 A1).
 */
export type LoginResult =
  | {
      status: 'authenticated';
      session: SessionTokens;
      role: UserRole;
      companyStatus: CompanyStatus | null;
    }
  | { status: 'verification_required'; email: string };

/**
 * A company's application status (MW_004 A1): `approved` opens the company portal, any other
 * value shows the application status page. `null` for customers and admins, and for a company
 * without an application row (treated as not approved).
 */
export type CompanyStatus = ApplicationStatus;

/** GET /api/me (MW_004 A1): who the logged-in user is, for routing. Any role. */
export type MeResponse = {
  id: string;
  role: UserRole;
  emailVerified: boolean;
  companyStatus: CompanyStatus | null;
};

/**
 * POST /api/auth/verify-email. A company gets its application reference (MW_002 A2):
 * the email is proven, so showing it no longer enumerates anything. Companies are not
 * logged in automatically (decision 6).
 */
export type VerifyEmailResult =
  | { verified: true; role: 'customer' }
  | {
      verified: true;
      role: 'company';
      application: { referenceNumber: string; status: ApplicationStatus };
    };
