import { Router } from 'express';
import { companyRegistrationSchema } from '@mirhalgo/shared';
import { respond } from '../middleware/asyncHandler.js';
import { companyRegisterLimit } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { companyUpload, parseApplicationField } from '../middleware/upload.js';
import * as companies from '../services/companies.js';
import type { IncomingFiles } from '../services/companyFiles.js';

/** /api/companies/* (MW_002 A3). Rate limit → multipart → shared Zod → service. */
export const companiesRouter = Router();

companiesRouter.post(
  '/register',
  companyRegisterLimit,
  companyUpload,
  parseApplicationField,
  validateBody(companyRegistrationSchema),
  respond(
    (req) =>
      companies.registerCompany(req.body, req.files as IncomingFiles | undefined, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      }),
    201,
  ),
);
