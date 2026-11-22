import { Router, type RequestHandler } from 'express';
import { orderDraftSchema, orderSchema } from '@mirhalgo/shared';
import { respond } from '../middleware/asyncHandler.js';
import { HttpError } from '../middleware/errorHandler.js';
import { draftSaveLimit, orderSubmitLimit } from '../middleware/rateLimit.js';
import { authUser, requireCustomer } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validate.js';
import { discardDraft, getDraft, parseService, saveDraft } from '../services/orderDrafts.js';
import { getOrder, submitOrder } from '../services/orders.js';

/** /api/orders/* (MW_003 B3 drafts, B4 submit + read). Customers only. */
export const ordersRouter = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Submit needs an `Idempotency-Key` (a UUID made by the client per submit attempt). */
const requireIdempotencyKey: RequestHandler = (req, _res, next) => {
  const key = req.get('idempotency-key') ?? '';
  next(
    UUID.test(key)
      ? undefined
      : new HttpError(400, 'VALIDATION_ERROR', 'Idempotency-Key header required'),
  );
};

ordersRouter.post(
  '/',
  requireCustomer,
  orderSubmitLimit,
  requireIdempotencyKey,
  validateBody(orderSchema),
  (req, res, next) => {
    submitOrder(authUser(req), req.body, req.get('idempotency-key')!.toLowerCase(), req.ip).then(
      ({ status, result }) => res.status(status).json({ ok: true, data: result }),
      next,
    );
  },
);

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

// after the /drafts routes: "/:reference" is one path segment (MG1029)
ordersRouter.get(
  '/:reference',
  requireCustomer,
  respond((req) => getOrder(authUser(req), req.params.reference ?? '')),
);
