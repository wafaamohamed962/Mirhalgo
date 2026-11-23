import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { COUNTRY_SCOPES, REFERENCE_LISTS, type ReferenceList } from '@mirhalgo/shared';
import { respond } from '../middleware/asyncHandler.js';
import { HttpError } from '../middleware/errorHandler.js';
import { CACHE_TTL_MS, listReference } from '../services/reference.js';

/** /api/reference/:list (MW_003 A2 + B1): public, read-only, cached reference lists. */
export const referenceRouter = Router();

const querySchema = z.object({
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  scope: z.enum(COUNTRY_SCOPES).default('all'),
});

/** Browsers and CDNs may keep a list as long as the API does (ETag: Express default). */
const cacheable: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', `public, max-age=${CACHE_TTL_MS / 1000}`);
  next();
};

referenceRouter.get(
  '/:list',
  cacheable,
  respond(async (req) => {
    const list = req.params.list as ReferenceList;
    if (!REFERENCE_LISTS.includes(list)) throw new HttpError(404, 'NOT_FOUND', 'Not found');
    const query = querySchema.safeParse(req.query);
    if (!query.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid input');
    return listReference(list, query.data);
  }),
);
