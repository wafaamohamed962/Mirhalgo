import type { Request, RequestHandler } from 'express';
import type { ApiSuccess } from '@mirhalgo/shared';

/**
 * Thin route adapter: runs a service call and sends `{ ok: true, data }`.
 * Errors (incl. async ones, which Express 4 does not catch) go to the error handler.
 */
export function respond<T>(handler: (req: Request) => Promise<T>, status = 200): RequestHandler {
  return (req, res, next) => {
    handler(req).then((data) => {
      const body: ApiSuccess<T> = { ok: true, data };
      res.status(status).json(body);
    }, next);
  };
}
