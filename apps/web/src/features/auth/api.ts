import type {
  ForgotPasswordInput,
  LoginInput,
  LoginResult,
  OtpSentResult,
  ResendOtpInput,
  ResetPasswordInput,
  SignupInput,
  VerifyEmailInput,
} from '@mirhalgo/shared';
import { apiPost } from '../../lib/apiClient';

/** Auth endpoints (spec section 7). Bodies are validated with the same shared schemas server-side. */
export const authApi = {
  signup: (input: SignupInput) => apiPost<OtpSentResult>('/auth/signup', input),
  verifyEmail: (input: VerifyEmailInput) =>
    apiPost<{ verified: true }>('/auth/verify-email', input),
  resendOtp: (input: ResendOtpInput) => apiPost<OtpSentResult>('/auth/resend-otp', input),
  login: (input: LoginInput) => apiPost<LoginResult>('/auth/login', input),
  forgotPassword: (input: ForgotPasswordInput) =>
    apiPost<OtpSentResult>('/auth/forgot-password', input),
  resetPassword: (input: ResetPasswordInput) => apiPost<null>('/auth/reset-password', input),
};
