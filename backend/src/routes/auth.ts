import { Router } from 'express';
import {
  forgotPasswordSchema,
  loginSchema,
  resendOtpSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
} from '@mirhalgo/shared';
import { respond } from '../middleware/asyncHandler.js';
import { loginLimit, otpSendLimit, signupLimit } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import * as auth from '../services/auth.js';

/** /api/auth/* (spec section 7). Thin: rate limit → validate → service. */
export const authRouter = Router();

authRouter.post(
  '/signup',
  signupLimit,
  validateBody(signupSchema),
  respond((req) => auth.signup(req.body, { ip: req.ip }), 201),
);

authRouter.post(
  '/verify-email',
  validateBody(verifyEmailSchema),
  respond((req) => auth.verifyEmail(req.body, { ip: req.ip })),
);

authRouter.post(
  '/resend-otp',
  otpSendLimit(),
  validateBody(resendOtpSchema),
  respond((req) => auth.sendOtpIfEligible(req.body, { ip: req.ip })),
);

authRouter.post(
  '/login',
  loginLimit,
  validateBody(loginSchema),
  respond((req) => auth.login(req.body, { ip: req.ip })),
);

authRouter.post(
  '/forgot-password',
  otpSendLimit('reset_password'),
  validateBody(forgotPasswordSchema),
  respond((req) =>
    auth.sendOtpIfEligible({ email: req.body.email, purpose: 'reset_password' }, { ip: req.ip }),
  ),
);

authRouter.post(
  '/reset-password',
  validateBody(resetPasswordSchema),
  respond((req) => auth.resetPassword(req.body, { ip: req.ip })),
);
