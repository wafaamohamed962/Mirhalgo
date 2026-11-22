/** OTP rules shared by the API (enforcement) and the web app (UI). Spec 4.3. */
export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_PER_HOUR = 5;

export const OTP_PURPOSES = ['signup', 'reset_password'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];
