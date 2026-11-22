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
  | 'sessions_revoked'
  // company registration (MW_002)
  | 'company_registered'
  | 'company_registration_failed'
  | 'company_registration_replaced'
  | 'company_existing_email'
  | 'company_phone_taken'
  | 'company_already_registered'
  | 'company_application_submitted'
  | 'company_registration_expired'
  // request balance (MW_003 B2)
  | 'balance_initial_grant'
  | 'balance_initial_grant_failed'
  | 'cleanup_run'
  | 'order_submitted'
  | 'order_no_balance'
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
  details: { userId?: string; email?: string; reason?: string; reference?: string } = {},
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
