import { Router } from 'express';
import { respond } from '../middleware/asyncHandler.js';
import { authUser, requireCustomer } from '../middleware/requireAuth.js';
import { getSummary } from '../services/me.js';

/** /api/me/* (MW_003 B2): the logged-in customer. */
export const meRouter = Router();

meRouter.get(
  '/summary',
  requireCustomer,
  respond((req) => getSummary(authUser(req))),
);
