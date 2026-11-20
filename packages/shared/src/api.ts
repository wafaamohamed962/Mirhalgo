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
  // client-side: a required VITE_* variable is missing (see apps/web/src/lib/env.ts)
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
 * may have logged in with their phone.
 */
export type LoginResult =
  | { status: 'authenticated'; session: SessionTokens }
  | { status: 'verification_required'; email: string };
