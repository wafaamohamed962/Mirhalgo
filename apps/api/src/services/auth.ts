import {
  OTP_RESEND_COOLDOWN_SECONDS,
  type LoginResult,
  type OtpPurpose,
  type OtpSentResult,
  type ResetPasswordInput,
  type SignupInput,
  type VerifyEmailInput,
  loginIdentifierSchema,
} from '@mirhalgo/shared';
import type { z } from 'zod';
import { logEvent } from '../lib/logger.js';
import { createSignInClient } from '../lib/supabase.js';
import { HttpError } from '../middleware/errorHandler.js';
import { assertMailConfigured, mail } from './mail/index.js';
import { issueOtp, verifyOtp } from './otp.js';
import {
  confirmEmail,
  createCustomer,
  findProfileByEmail,
  findProfileByPhone,
  refreshUnverifiedCustomer,
  setPassword,
  type WriteCustomerResult,
} from './users.js';

/*
 * Auth flows (spec section 4). No user enumeration: signup, resend and forgot
 * password always answer with the same neutral OtpSentResult, and login failures
 * are always INVALID_CREDENTIALS.
 */

type Ctx = { ip?: string };

const neutral = (email: string): OtpSentResult => ({
  email,
  cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
});

/** Creates the customer, or refreshes the unverified one with this email. Phone must be free. */
async function writeCustomer(
  input: SignupInput,
  unverifiedUserId: string | undefined,
): Promise<WriteCustomerResult> {
  const phoneOwner = await findProfileByPhone(input.phone);
  if (phoneOwner && phoneOwner.id !== unverifiedUserId) return { ok: false, reason: 'phone_taken' };
  return unverifiedUserId
    ? refreshUnverifiedCustomer(unverifiedUserId, input)
    : createCustomer(input);
}

/** POST /auth/signup (spec 4.2 + the "neutral duplicates" decision in CLAUDE.md §11). */
export async function signup(input: SignupInput, { ip }: Ctx): Promise<OtpSentResult> {
  assertMailConfigured(); // every branch below sends an email
  const existing = await findProfileByEmail(input.email);

  if (existing?.email_verified_at) {
    await mail.accountExists(input.email);
    logEvent('signup_existing_email', ip, { userId: existing.id });
    return neutral(input.email);
  }

  const result = await writeCustomer(input, existing?.id);
  if (!result.ok) {
    await mail.phoneTaken(input.email);
    logEvent('signup_phone_taken', ip, { email: input.email });
    return neutral(input.email);
  }

  logEvent('signup', ip, { userId: result.userId });
  await issueOtp({ userId: result.userId, email: input.email, purpose: 'signup', ip });
  return neutral(input.email);
}

/**
 * POST /auth/resend-otp and /auth/forgot-password: sends a code only when the
 * account is eligible, but always answers the same way. SMTP failures are logged,
 * not returned, so they cannot reveal whether the account exists.
 */
export async function sendOtpIfEligible(
  { email, purpose }: { email: string; purpose: OtpPurpose },
  { ip }: Ctx,
): Promise<OtpSentResult> {
  assertMailConfigured(); // same answer for every address, before the lookup
  const profile = await findProfileByEmail(email);
  const eligible = purpose === 'signup' ? profile && !profile.email_verified_at : profile;

  if (profile && eligible) {
    await issueOtp({ userId: profile.id, email, purpose, ip }).catch((error: unknown) => {
      if (!(error instanceof HttpError)) throw error; // MAIL_FAILED is already logged
    });
  }
  return neutral(email);
}

/** POST /auth/verify-email (spec 4.3). The client then logs in with the password it kept. */
export async function verifyEmail({ email, code }: VerifyEmailInput, { ip }: Ctx) {
  const userId = await verifyOtp({ email, code, purpose: 'signup', ip });
  await confirmEmail(userId);
  logEvent('email_verified', ip, { userId });
  return { verified: true as const };
}

type LoginIdentifier = z.output<typeof loginIdentifierSchema>;

const invalidCredentials = () =>
  new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email/phone or password');

/** POST /auth/login (spec 4.4): email or phone + password → Supabase session. */
export async function login(
  { identifier, password }: { identifier: LoginIdentifier; password: string },
  { ip }: Ctx,
): Promise<LoginResult> {
  const email =
    identifier.type === 'email'
      ? identifier.value
      : (await findProfileByPhone(identifier.value))?.email;
  if (!email) {
    logEvent('login_failed', ip, { reason: 'unknown_phone' });
    throw invalidCredentials();
  }

  const { data, error } = await createSignInClient().auth.signInWithPassword({ email, password });

  // Supabase checks the password before the confirmation, so this means "right password".
  if (error?.code === 'email_not_confirmed') {
    logEvent('login_unverified', ip, { email });
    await sendOtpIfEligible({ email, purpose: 'signup' }, { ip });
    return { status: 'verification_required', email };
  }
  if (error || !data.session) {
    logEvent('login_failed', ip, { email, reason: error?.code ?? 'no_session' });
    throw invalidCredentials();
  }

  logEvent('login_success', ip, { userId: data.user.id });
  const { access_token, refresh_token } = data.session;
  return { status: 'authenticated', session: { access_token, refresh_token } };
}

/** POST /auth/reset-password (spec 4.6). */
export async function resetPassword({ email, code, password }: ResetPasswordInput, { ip }: Ctx) {
  const userId = await verifyOtp({ email, code, purpose: 'reset_password', ip });
  await setPassword(userId, password);
  logEvent('password_reset', ip, { userId });
  return null;
}
