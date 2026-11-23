import type { Request, RequestHandler } from 'express';
import type { UserRole } from '@mirhalgo/shared';
import { db } from '../lib/supabase.js';
import { HttpError } from './errorHandler.js';

/** The verified caller of an authenticated endpoint. */
export type AuthUser = { id: string; email: string; role: UserRole };

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by requireRole(); read it with authUser(req). */
    authUser?: AuthUser;
  }
}

const unauthorized = () => new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
const forbidden = () => new HttpError(403, 'FORBIDDEN', 'Not allowed');

/**
 * Bearer token → Supabase Auth (`auth.getUser`, decision 26: checked by the Auth server on
 * every request, so a logged-out or revoked session stops working at once) → the role in
 * app_metadata (the source of truth, decision 3) must match.
 */
export function requireRole(role: UserRole): RequestHandler {
  return (req, _res, next) => {
    const token = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '')?.[1];
    if (!token) return next(unauthorized());
    db.auth.getUser(token).then(({ data, error }) => {
      if (error || !data.user) return next(unauthorized());
      if (data.user.app_metadata?.role !== role) return next(forbidden());
      req.authUser = { id: data.user.id, email: data.user.email ?? '', role };
      next();
    }, next);
  };
}

/** Customer-portal endpoints (MW_003 B). Companies and admins get 403. */
export const requireCustomer = requireRole('customer');

/** The caller set by requireRole(); a missing one is a wiring mistake (500). */
export function authUser(req: Request): AuthUser {
  if (!req.authUser) throw new Error('authUser() used on a route without requireRole()');
  return req.authUser;
}
