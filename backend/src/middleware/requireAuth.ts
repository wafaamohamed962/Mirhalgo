import type { Request, RequestHandler } from 'express';
import { USER_ROLES, type UserRole } from '@mirhalgo/shared';
import { db } from '../lib/supabase.js';
import { HttpError } from './errorHandler.js';

/** The verified caller of an authenticated endpoint. */
export type AuthUser = { id: string; email: string; role: UserRole; emailVerified: boolean };

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by requireRole() / requireAuthenticated; read it with authUser(req). */
    authUser?: AuthUser;
  }
}

const unauthorized = () => new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
const forbidden = () => new HttpError(403, 'FORBIDDEN', 'Not allowed');

const isRole = (value: unknown): value is UserRole => USER_ROLES.includes(value as UserRole);

/**
 * Bearer token → Supabase Auth (`auth.getUser`, decision 26: checked by the Auth server on
 * every request, so a logged-out or revoked session stops working at once) → the role in
 * app_metadata (the source of truth, decision 3) must be a known role, and one of `allow`
 * when given.
 */
function authenticate(allow?: readonly UserRole[]): RequestHandler {
  return (req, _res, next) => {
    const token = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '')?.[1];
    if (!token) return next(unauthorized());
    db.auth.getUser(token).then(({ data, error }) => {
      if (error || !data.user) return next(unauthorized());
      const role: unknown = data.user.app_metadata?.role;
      if (!isRole(role) || (allow && !allow.includes(role))) return next(forbidden());
      req.authUser = {
        id: data.user.id,
        email: data.user.email ?? '',
        role,
        emailVerified: Boolean(data.user.email_confirmed_at),
      };
      next();
    }, next);
  };
}

/** Endpoints of one role. Other roles get 403. */
export const requireRole = (role: UserRole): RequestHandler => authenticate([role]);

/** Customer-portal endpoints (MW_003 B). Companies and admins get 403. */
export const requireCustomer = requireRole('customer');

/** Endpoints open to every role (GET /api/me, MW_004 A1). A user without a role gets 403. */
export const requireAuthenticated = authenticate();

/** The caller set by the middleware above; a missing one is a wiring mistake (500). */
export function authUser(req: Request): AuthUser {
  if (!req.authUser) throw new Error('authUser() used on a route without requireRole()');
  return req.authUser;
}
