import { Router } from 'express';
import { respond } from '../middleware/asyncHandler.js';
import { authUser, requireAuthenticated, requireCustomer } from '../middleware/requireAuth.js';
import { getMe, getSummary } from '../services/me.js';

/** /api/me/*: the logged-in user. */
export const meRouter = Router();

// any role (MW_004 A1): role + company status for routing
meRouter.get(
  '/',
  requireAuthenticated,
  respond((req) => getMe(authUser(req))),
);

// the customer's page header (MW_003 B2)
meRouter.get(
  '/summary',
  requireCustomer,
  respond((req) => getSummary(authUser(req))),
);
