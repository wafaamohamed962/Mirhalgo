import { Router } from 'express';
import { contactSchema } from '@mirhalgo/shared';
import { respond } from '../middleware/asyncHandler.js';
import { contactLimit } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { submitContactMessage } from '../services/contact.js';

/** POST /api/contact (spec 3.5): 5 / hour / IP. */
export const contactRouter = Router();

contactRouter.post(
  '/',
  contactLimit,
  validateBody(contactSchema),
  respond((req) => submitContactMessage(req.body, { ip: req.ip }), 201),
);
