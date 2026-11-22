import path from 'node:path';
import sharp from 'sharp';
import {
  DOCUMENT_TYPES,
  FILE_RULES,
  checkFile,
  detectMime,
  type AllowedMime,
  type DocumentType,
} from '@mirhalgo/shared';
import { HttpError } from '../middleware/errorHandler.js';

/*
 * Server-side file checks (spec A3 step 3, A5, decision 5):
 * - the type comes from the real content (magic bytes), never the extension / client MIME;
 * - size limits per document type;
 * - images are decoded and re-encoded with sharp: strips EXIF/GPS and anything appended to
 *   the image (polyglot files). The logo becomes a 512×512 WEBP square;
 * - PDFs are checked by signature + size only and never parsed.
 * Virus scanning is out of scope (future item).
 */

/** What multer gives us for one field. */
export type IncomingFile = { buffer: Buffer; originalname: string; size: number };
export type IncomingFiles = Partial<Record<string, IncomingFile[]>>;

export type PreparedFile = {
  type: DocumentType;
  buffer: Buffer;
  mime: AllowedMime;
  extension: string;
  originalName: string;
  size: number;
};

const LOGO_SIZE = 512;
/** Large photos of documents are scaled down (still readable) to stay under the limits. */
const MAX_DOCUMENT_IMAGE_SIDE = 4000;
/** Decompression-bomb guard: refuse images above ~50 megapixels before decoding. */
const MAX_INPUT_PIXELS = 50_000_000;

const EXTENSIONS: Record<AllowedMime, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const typeNotAllowed = () => new HttpError(400, 'FILE_TYPE_NOT_ALLOWED', 'File type not allowed');
const tooLarge = () => new HttpError(413, 'FILE_TOO_LARGE', 'File too large');

/** Re-encodes an image (metadata is dropped by default). Throws if it cannot be decoded. */
async function reencodeImage(
  buffer: Buffer,
  mime: AllowedMime,
  type: DocumentType,
): Promise<{ buffer: Buffer; mime: AllowedMime }> {
  const image = sharp(buffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS }).rotate();

  if (type === 'logo') {
    const logo = await image.resize(LOGO_SIZE, LOGO_SIZE, { fit: 'cover' }).webp({ quality: 85 });
    return { buffer: await logo.toBuffer(), mime: 'image/webp' };
  }

  const resized = image.resize(MAX_DOCUMENT_IMAGE_SIDE, MAX_DOCUMENT_IMAGE_SIDE, {
    fit: 'inside',
    withoutEnlargement: true,
  });
  const encoded =
    mime === 'image/png'
      ? resized.png({ compressionLevel: 9 })
      : resized.jpeg({ quality: 85, mozjpeg: true });
  return { buffer: await encoded.toBuffer(), mime };
}

/**
 * Display name only (files are stored under random UUIDs). Busboy decodes multipart
 * filenames as latin1, so UTF-8 names (Arabic) are decoded again.
 */
export function cleanOriginalName(raw: string, fallback: string): string {
  const utf8 = Buffer.from(raw, 'latin1').toString('utf8');
  const decoded = utf8.includes('�') ? raw : utf8;
  const name = path
    .basename(decoded.replaceAll('\\', '/'))
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, 255);
  return name || fallback;
}

async function prepareFile(type: DocumentType, file: IncomingFile): Promise<PreparedFile> {
  const detected = detectMime(file.buffer.subarray(0, 16));
  const error = checkFile({ size: file.size, mime: detected }, type);
  if (error) throw error === FILE_RULES[type].sizeError ? tooLarge() : typeNotAllowed();

  let buffer = file.buffer;
  let mime = detected as AllowedMime;
  if (mime !== 'application/pdf') {
    try {
      ({ buffer, mime } = await reencodeImage(buffer, mime, type));
    } catch {
      throw typeNotAllowed(); // corrupt / not really an image
    }
    if (buffer.length > FILE_RULES[type].maxBytes) throw tooLarge();
  }

  const extension = EXTENSIONS[mime];
  return {
    type,
    buffer,
    mime,
    extension,
    originalName: cleanOriginalName(file.originalname, `${type}.${extension}`),
    size: buffer.length,
  };
}

/** Validates every received file and the required ones. In document-type order. */
export async function prepareFiles(files: IncomingFiles = {}): Promise<PreparedFile[]> {
  const prepared: PreparedFile[] = [];
  for (const type of DOCUMENT_TYPES) {
    const file = files[type]?.[0];
    if (!file) {
      if (FILE_RULES[type].required) {
        throw new HttpError(400, 'FILE_REQUIRED', 'A required document is missing');
      }
      continue;
    }
    prepared.push(await prepareFile(type, file));
  }
  return prepared;
}
