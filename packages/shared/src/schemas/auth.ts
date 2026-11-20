import { z } from 'zod';
import { OTP_PURPOSES } from '../otp.js';
import { PASSWORD_MAX } from '../password.js';
import { normalizePhone } from '../phone.js';
import { emailSchema, nameSchema, otpCodeSchema, passwordSchema, phoneSchema } from './fields.js';

export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];

const passwordsMatch = (data: { password: string; confirmPassword: string }) =>
  data.password === data.confirmPassword;
const mismatch = { message: 'validation.passwordMismatch', path: ['confirmPassword'] };

/** POST /api/auth/signup (spec 4.2) */
export const signupSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    gender: z.enum(GENDERS, { errorMap: () => ({ message: 'validation.required' }) }),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: 'validation.terms' }) }),
  })
  .refine(passwordsMatch, mismatch);
export type SignupInput = z.infer<typeof signupSchema>;

/** POST /api/auth/verify-email (spec 4.3) */
export const verifyEmailSchema = z.object({ email: emailSchema, code: otpCodeSchema });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/** POST /api/auth/resend-otp */
export const resendOtpSchema = z.object({ email: emailSchema, purpose: z.enum(OTP_PURPOSES) });
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;

/**
 * Login identifier: an email or a phone (spec 4.4).
 * Parsed into a tagged value so the server knows how to resolve it.
 */
export const loginIdentifierSchema = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .max(254, 'validation.identifier')
  .transform((value, ctx) => {
    if (value.includes('@')) {
      const email = emailSchema.safeParse(value);
      if (email.success) return { type: 'email' as const, value: email.data };
    } else {
      const phone = normalizePhone(value);
      if (phone) return { type: 'phone' as const, value: phone };
    }
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.identifier' });
    return z.NEVER;
  });

/** POST /api/auth/login. Password strength is not checked here, only presence. */
export const loginSchema = z.object({
  identifier: loginIdentifierSchema,
  password: z.string().min(1, 'validation.required').max(PASSWORD_MAX, 'validation.passwordMax'),
});
/** What the form holds / what is sent over the wire. */
export type LoginInput = z.input<typeof loginSchema>;

/** POST /api/auth/forgot-password (spec 4.6) */
export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** POST /api/auth/reset-password (spec 4.6) */
export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    code: otpCodeSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(passwordsMatch, mismatch);
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
