import {
  USER_ROLES,
  type LoginResult,
  type OtpPurpose,
  type OtpSentResult,
  type ResetPasswordInput,
  type SignupInput,
  type UserRole,
  type VerifyEmailInput,
  type VerifyEmailResult,
  loginIdentifierSchema,
} from '@mirhalgo/shared';
import type { z } from 'zod';
import { logEvent } from '../lib/logger.js';
import { createSignInClient } from '../lib/supabase.js';
import { HttpError } from '../middleware/errorHandler.js';
import { grantInitialBalance } from './balance.js';
import { completeCompanyVerification } from './companies.js';
import { assertMailConfigured, mail } from './mail/index.js';
import { issueOtp, otpSentResult, verifyOtp } from './otp.js';
import {
  confirmEmail,
  createCustomer,
  findProfileByEmail,
  findProfileByPhone,
  refreshUnverifiedCustomer,
  revokeSessions,
  setPassword,
  type WriteCustomerResult,
} from './users.js';

/*
 * Auth flows (spec section 4). No user enumeration: signup, resend and forgot
 * password always answer with the same neutral OtpSentResult, and login failures
 * are always INVALID_CREDENTIALS.
 */

type Ctx = { ip?: string };

const neutral = otpSentResult;

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

  // An unverified account of another kind (a company application) is never touched by a
  // customer sign up (MW_002 decision 2).
  if (existing && existing.role !== 'customer') {
    logEvent('signup_existing_email', ip, { userId: existing.id, reason: existing.role });
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

/**
 * POST /auth/verify-email (spec 4.3). A customer then logs in with the password the client
 * kept. A company application moves to pending_review first (MW_002 A2), and the company is
 * not logged in (decision 6).
 */
export async function verifyEmail(
  { email, code }: VerifyEmailInput,
  { ip }: Ctx,
): Promise<VerifyEmailResult> {
  const userId = await verifyOtp({ email, code, purpose: 'signup', ip });
  const profile = await findProfileByEmail(email);

  // Company: status first, then the email. Both steps are idempotent, so if confirming fails
  // the user can request a new code and verify again.
  const application =
    profile?.role === 'company' ? await completeCompanyVerification(userId, email, { ip }) : null;
  await confirmEmail(userId);
  logEvent('email_verified', ip, { userId });
  if (!application) {
    // 5 requests for a new customer (MW_003 B7). Never fails the verification: GET /me/summary
    // repeats the same idempotent grant if this one did not go through.
    await grantInitialBalance(userId, ip).catch((error: Error) => {
      logEvent('balance_initial_grant_failed', ip, { userId, reason: error.message });
    });
  }

  return application
    ? { verified: true, role: 'company', application }
    : { verified: true, role: 'customer' };
}

type LoginIdentifier = z.output<typeof loginIdentifierSchema>;

const isRole = (value: unknown): value is UserRole =>
  typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);

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

  // app_metadata.role is the source of truth (decision 3); the profile is the mirror.
  const metadataRole: unknown = data.user.app_metadata?.role;
  const role = isRole(metadataRole) ? metadataRole : (await findProfileByEmail(email))?.role;
  if (!role) {
    logEvent('login_failed', ip, { userId: data.user.id, reason: 'no_role' });
    throw invalidCredentials();
  }

  logEvent('login_success', ip, { userId: data.user.id, reason: role });
  const { access_token, refresh_token } = data.session;
  return { status: 'authenticated', session: { access_token, refresh_token }, role };
}

/** POST /auth/reset-password (spec 4.6). */
export async function resetPassword({ email, code, password }: ResetPasswordInput, { ip }: Ctx) {
  const userId = await verifyOtp({ email, code, purpose: 'reset_password', ip });
  await setPassword(userId, password);
  logEvent('password_reset', ip, { userId });
  // Decision 8: sign out every existing session (the reset flow has none of its own).
  await revokeSessions(userId);
  logEvent('sessions_revoked', ip, { userId });
  return null;
}
