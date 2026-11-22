import type { RequestHandler } from 'express';
import multer from 'multer';
import { DOCUMENT_TYPES, FILE_RULES, MAX_UPLOAD_FILES } from '@mirhalgo/shared';
import { HttpError } from './errorHandler.js';

/*
 * multipart/form-data for POST /api/companies/register (spec A3 + A5):
 * one `application` field (JSON) + at most one file per document type, 4 files max.
 * Files stay in memory (≤ 4 × 5 MB) and are checked by real content in services/companyFiles.
 */

const MAX_FILE_BYTES = Math.max(...DOCUMENT_TYPES.map((type) => FILE_RULES[type].maxBytes));
/** The application JSON is a few KB; this also caps the arrays Zod has to validate. */
const MAX_FIELD_BYTES = 16 * 1024;

const parser = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: MAX_UPLOAD_FILES,
    fields: 1,
    fieldSize: MAX_FIELD_BYTES,
    parts: MAX_UPLOAD_FILES + 1,
    headerPairs: 100,
  },
}).fields(DOCUMENT_TYPES.map((name) => ({ name, maxCount: 1 })));

function toHttpError(error: unknown): unknown {
  if (!(error instanceof multer.MulterError)) return error;
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return new HttpError(413, 'FILE_TOO_LARGE', 'File too large');
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_UNEXPECTED_FILE': // unknown field name or a second file of the same type
      return new HttpError(400, 'TOO_MANY_FILES', 'Unexpected or too many files');
    case 'LIMIT_FIELD_VALUE':
    case 'LIMIT_PART_COUNT':
    case 'LIMIT_FIELD_COUNT':
    case 'LIMIT_FIELD_KEY':
      return new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Payload too large');
    default:
      return new HttpError(400, 'VALIDATION_ERROR', 'Invalid upload');
  }
}

/** Parses the multipart body; multer errors become API errors. */
export const companyUpload: RequestHandler = (req, res, next) => {
  parser(req, res, (error?: unknown) => next(error ? toHttpError(error) : undefined));
};

/** The `application` field holds JSON: parse it into req.body for validateBody(). */
export const parseApplicationField: RequestHandler = (req, _res, next) => {
  const raw: unknown = req.body?.application;
  if (typeof raw !== 'string') {
    return next(new HttpError(400, 'VALIDATION_ERROR', 'Invalid input'));
  }
  try {
    req.body = JSON.parse(raw);
    next();
  } catch {
    next(new HttpError(400, 'INVALID_JSON', 'Invalid JSON'));
  }
};
