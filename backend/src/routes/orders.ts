import { Router } from 'express';
import { orderDraftSchema } from '@mirhalgo/shared';
import { respond } from '../middleware/asyncHandler.js';
import { draftSaveLimit } from '../middleware/rateLimit.js';
import { authUser, requireCustomer } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validate.js';
import { discardDraft, getDraft, parseService, saveDraft } from '../services/orderDrafts.js';

/** /api/orders/* (MW_003 B3 drafts; submit + read in B4). Customers only. */
export const ordersRouter = Router();

ordersRouter.get(
  '/drafts/:service',
  requireCustomer,
  respond((req) => getDraft(authUser(req), parseService(req.params.service))),
);

ordersRouter.put(
  '/drafts/:service',
  requireCustomer,
  draftSaveLimit,
  validateBody(orderDraftSchema),
  respond((req) => saveDraft(authUser(req), parseService(req.params.service), req.body)),
);

ordersRouter.delete(
  '/drafts/:service',
  requireCustomer,
  respond(async (req) => {
    await discardDraft(authUser(req), parseService(req.params.service));
    return null;
  }),
);
