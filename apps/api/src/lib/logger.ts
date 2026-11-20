export type AuditEvent =
  | 'signup'
  | 'signup_existing_email'
  | 'signup_phone_taken'
  | 'login_success'
  | 'login_failed'
  | 'login_unverified'
  | 'otp_sent'
  | 'otp_skipped'
  | 'otp_failed'
  | 'otp_verify_failed'
  | 'email_verified'
  | 'password_reset'
  | 'contact_message'
  | 'contact_spam';

/** "ali@example.com" → "a***@example.com": enough to correlate, without storing the address. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * Structured audit log line (auth events, spec section 5) with timestamp + IP.
 * NEVER pass passwords or OTP codes in `details`.
 */
export function logEvent(
  event: AuditEvent,
  ip: string | undefined,
  details: { userId?: string; email?: string; reason?: string } = {},
) {
  const { email, ...rest } = details;
  console.log(
    JSON.stringify({
      type: 'audit',
      event,
      at: new Date().toISOString(),
      ip,
      ...(email && { email: maskEmail(email) }),
      ...rest,
    }),
  );
}
