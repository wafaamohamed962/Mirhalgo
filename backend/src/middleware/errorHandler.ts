import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import type { ApiError, ErrorCode } from '@mirhalgo/shared';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function sendError(res: Response, status: number, code: ErrorCode, message: string) {
  const body: ApiError = { ok: false, error: { code, message } };
  res.status(status).json(body);
}

export const notFound: RequestHandler = (_req, res) => {
  sendError(res, 404, 'NOT_FOUND', 'Not found');
};

// Always respond with { ok: false, error: { code, message } } (spec section 7).
// Never leak stack traces to the client.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) return sendError(res, err.status, err.code, err.message);
  // body-parser errors (invalid JSON, body > 10kb)
  if (err?.type === 'entity.too.large') {
    return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'Payload too large');
  }
  if (err?.type === 'entity.parse.failed')
    return sendError(res, 400, 'INVALID_JSON', 'Invalid JSON');
  console.error(err);
  sendError(res, 500, 'INTERNAL', 'Something went wrong');
};
