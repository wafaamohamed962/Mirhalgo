import { Router } from 'express';
import { respond } from '../middleware/asyncHandler.js';
import { uploadLimit } from '../middleware/rateLimit.js';
import { authUser, requireCustomer } from '../middleware/requireAuth.js';
import { orderUpload } from '../middleware/upload.js';
import { deleteOrderUpload, uploadOrderFile } from '../services/orderUploads.js';

/** /api/uploads (MW_003 B3): one file per request, before submit. Customers only. */
export const uploadsRouter = Router();

uploadsRouter.post(
  '/',
  requireCustomer,
  uploadLimit,
  orderUpload,
  respond((req) => uploadOrderFile(authUser(req), req.body?.purpose, req.file), 201),
);

uploadsRouter.delete(
  '/:id',
  requireCustomer,
  respond(async (req) => {
    await deleteOrderUpload(authUser(req), req.params.id ?? '');
    return null;
  }),
);
