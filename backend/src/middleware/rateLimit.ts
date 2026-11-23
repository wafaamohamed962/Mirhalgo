import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { OTP_MAX_PER_HOUR, OTP_RESEND_COOLDOWN_SECONDS, type ErrorCode } from '@mirhalgo/shared';
import { HttpError } from './errorHandler.js';

/*
 * Rate limits (spec section 5), per IP + per identifier.
 * In-memory store: fine for the single Render instance. Use a shared store
 * (e.g. Redis) if the API is ever scaled horizontally. The database also enforces
 * the OTP cooldown / hourly limit, and OTP attempts are limited per code in SQL.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const clientIp = (req: Request) => ipKeyGenerator(req.ip ?? '');

/** Raw identifier from the body (runs before validation), trimmed + lowercased. */
const bodyField = (field: string) => (req: Request) => {
  const value: unknown = req.body?.[field];
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
};

type LimitOptions = {
  name: string;
  windowMs: number;
  limit: number;
  /** Per-identifier limiter: key from the body. Falls back to the IP when missing. */
  key?: (req: Request) => string | null;
  code?: ErrorCode;
};

function limiter({ name, windowMs, limit, key, code = 'RATE_LIMITED' }: LimitOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `${name}:${key?.(req) ?? clientIp(req)}`,
    handler: (_req, _res, next) => next(new HttpError(429, code, 'Too many requests')),
  });
}

/** Both limits apply: per IP and per identifier. */
const perIpAndIdentifier = (opts: Omit<LimitOptions, 'key'> & { field: string }) => [
  limiter({ ...opts, name: `${opts.name}-ip` }),
  limiter({ ...opts, name: `${opts.name}-id`, key: bodyField(opts.field) }),
];

export const loginLimit = perIpAndIdentifier({
  name: 'login',
  windowMs: 15 * MINUTE,
  limit: 10,
  field: 'identifier',
});

export const signupLimit = perIpAndIdentifier({
  name: 'signup',
  windowMs: HOUR,
  limit: 5,
  field: 'email',
});

/** OTP send / resend: 5 / hour / email (+ IP) and a 60 s cooldown per email + purpose. */
export const otpSendLimit = (purpose?: string) => [
  ...perIpAndIdentifier({ name: 'otp', windowMs: HOUR, limit: OTP_MAX_PER_HOUR, field: 'email' }),
  limiter({
    name: 'otp-cooldown',
    windowMs: OTP_RESEND_COOLDOWN_SECONDS * 1000,
    limit: 1,
    code: 'OTP_COOLDOWN',
    key: (req) => {
      const email = bodyField('email')(req);
      return email && `${purpose ?? bodyField('purpose')(req)}:${email}`;
    },
  }),
];

export const contactLimit = limiter({ name: 'contact', windowMs: HOUR, limit: 5 });

/** POST /companies/register: 3 / hour / IP (spec A5). Runs before the upload is parsed. */
export const companyRegisterLimit = limiter({ name: 'company-register', windowMs: HOUR, limit: 3 });

/** Per logged-in user (after requireCustomer), MW_003 spec B9. */
const perUser = (name: string, windowMs: number, limit: number) =>
  limiter({ name, windowMs, limit, key: (req) => req.authUser?.id ?? null });
export const uploadLimit = perUser('upload', HOUR, 60);
export const draftSaveLimit = perUser('draft-save', MINUTE, 60);
export const orderSubmitLimit = perUser('order-submit', HOUR, 10);
