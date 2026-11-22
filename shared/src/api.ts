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
  'NOT_FOUND',
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
 * may have logged in with their phone. `role` routes the client (MW_002 A6).
 */
export type LoginResult =
  | { status: 'authenticated'; session: SessionTokens; role: UserRole }
  | { status: 'verification_required'; email: string };

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
