import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_HOUR,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
  type OtpPurpose,
} from '@mirhalgo/shared';
import { config } from '../config.js';
import { logEvent } from '../lib/logger.js';
import { db } from '../lib/supabase.js';
import { HttpError } from '../middleware/errorHandler.js';
import { mail } from './mail/index.js';

/*
 * Our own email OTP (spec 4.3, never Supabase OTP / magic links):
 * 6 digits from crypto.randomInt · only HMAC-SHA256(code, OTP_PEPPER) is stored ·
 * compared with timingSafeEqual · 10 min expiry · single use · 5 wrong attempts max ·
 * a new code invalidates older unused codes of the same purpose ·
 * 60 s resend cooldown · max 5 codes / hour / email.
 */

const MINUTE = 60_000;

export function generateOtpCode(): string {
  return randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, '0');
}

export function hashOtp(code: string): string {
  return createHmac('sha256', config.OTP_PEPPER).update(code).digest('hex');
}

export function otpHashesMatch(storedHex: string, candidateHex: string): boolean {
  const stored = Buffer.from(storedHex, 'hex');
  const candidate = Buffer.from(candidateHex, 'hex');
  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
}

type IssueOtpInput = { userId: string; email: string; purpose: OtpPurpose; ip?: string };

/**
 * Creates and emails a new code. Returns false (without sending) when the email
 * is inside the cooldown or over the hourly limit, so callers can answer neutrally.
 * Throws HttpError MAIL_FAILED when SMTP fails.
 */
export async function issueOtp({ userId, email, purpose, ip }: IssueOtpInput): Promise<boolean> {
  const now = Date.now();
  const { data: recent, error } = await db
    .from('email_otps')
    .select('purpose, created_at')
    .eq('email', email)
    .gte('created_at', new Date(now - 60 * MINUTE).toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;

  const lastSamePurpose = recent.find((otp) => otp.purpose === purpose);
  const inCooldown =
    lastSamePurpose &&
    now - Date.parse(lastSamePurpose.created_at) < OTP_RESEND_COOLDOWN_SECONDS * 1000;
  if (inCooldown || recent.length >= OTP_MAX_PER_HOUR) {
    logEvent('otp_skipped', ip, { userId, reason: inCooldown ? 'cooldown' : 'hourly_limit' });
    return false;
  }

  const invalidated = await db
    .from('email_otps')
    .update({ invalidated_at: new Date(now).toISOString() })
    .eq('email', email)
    .eq('purpose', purpose)
    .is('consumed_at', null)
    .is('invalidated_at', null);
  if (invalidated.error) throw invalidated.error;

  const code = generateOtpCode();
  const inserted = await db
    .from('email_otps')
    .insert({
      user_id: userId,
      email,
      purpose,
      code_hash: hashOtp(code),
      expires_at: new Date(now + OTP_TTL_MINUTES * MINUTE).toISOString(),
      ip: ip ?? null,
    })
    .select('id')
    .single();
  if (inserted.error) throw inserted.error;

  try {
    await mail.otp(email, code, purpose);
  } catch (mailError) {
    // the user never got this code: don't let it count as the active one
    await db
      .from('email_otps')
      .update({ invalidated_at: new Date().toISOString() })
      .eq('id', inserted.data.id);
    logEvent('otp_failed', ip, { userId, reason: purpose });
    throw mailError; // HttpError MAIL_FAILED
  }

  logEvent('otp_sent', ip, { userId, reason: purpose });
  return true;
}

type VerifyOtpInput = { email: string; purpose: OtpPurpose; code: string; ip?: string };

/**
 * Checks a code and consumes it on success. Returns the owner's user id.
 * Wrong / expired / reused codes are rejected; the attempt is reserved atomically
 * in the database before comparing, so parallel guesses cannot exceed the limit.
 */
export async function verifyOtp({ email, purpose, code, ip }: VerifyOtpInput): Promise<string> {
  const { data, error } = await db
    .rpc('claim_otp_attempt', {
      p_email: email,
      p_purpose: purpose,
      p_max_attempts: OTP_MAX_ATTEMPTS,
    })
    .single();
  if (error) throw error;

  const fail = (
    status: number,
    errorCode: 'OTP_INVALID' | 'OTP_EXPIRED' | 'OTP_TOO_MANY_ATTEMPTS',
  ) => {
    logEvent('otp_verify_failed', ip, { userId: data.user_id ?? undefined, reason: errorCode });
    return new HttpError(status, errorCode, 'Invalid code');
  };

  if (data.status === 'none' || data.status === 'expired') throw fail(400, 'OTP_EXPIRED');
  if (data.status === 'exhausted') throw fail(429, 'OTP_TOO_MANY_ATTEMPTS');
  if (!data.otp_id || !data.user_id || !data.code_hash)
    throw new Error('claim_otp_attempt: incomplete row');

  if (!otpHashesMatch(data.code_hash, hashOtp(code))) {
    if ((data.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
      await db
        .from('email_otps')
        .update({ invalidated_at: new Date().toISOString() })
        .eq('id', data.otp_id);
      throw fail(429, 'OTP_TOO_MANY_ATTEMPTS');
    }
    throw fail(400, 'OTP_INVALID');
  }

  // single use: only succeeds if nobody consumed / invalidated it in the meantime
  const consumed = await db
    .from('email_otps')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', data.otp_id)
    .is('consumed_at', null)
    .is('invalidated_at', null)
    .select('id');
  if (consumed.error) throw consumed.error;
  if (consumed.data.length === 0) throw fail(400, 'OTP_EXPIRED');

  return data.user_id;
}
