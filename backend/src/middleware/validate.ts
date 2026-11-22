import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { HttpError } from './errorHandler.js';

/**
 * Validates `req.body` with a shared Zod schema (the same one the web form uses)
 * and replaces it with the parsed, normalised value. Never trust the client.
 */
export function validateBody(schema: z.ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return next(new HttpError(400, 'VALIDATION_ERROR', 'Invalid input'));
    req.body = parsed.data;
    next();
  };
}
