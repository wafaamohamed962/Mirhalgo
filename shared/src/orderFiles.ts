import { detectMime } from './files.js';

/**
 * Order attachments (MW_003 B3, spec B9 + decision 25). The type always comes from the file
 * content, on the client (instant feedback) and again on the server. Nothing here opens,
 * parses or executes a document: Office files are only recognised by their container.
 */

export const ORDER_UPLOAD_PURPOSES = [
  'packing_list',
  'msds',
  'invoice',
  'document',
  'screenshot',
] as const;
export type OrderUploadPurpose = (typeof ORDER_UPLOAD_PURPOSES)[number];

export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DOC = 'application/msword';
const XLS = 'application/vnd.ms-excel';

const ORDER_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const ORDER_DOCUMENT_MIMES = [
  'application/pdf',
  DOCX,
  XLSX,
  DOC,
  XLS,
  'text/csv',
  ...ORDER_IMAGE_MIMES,
] as const;
export type OrderMime = (typeof ORDER_DOCUMENT_MIMES)[number];
export const ORDER_MIMES: readonly OrderMime[] = ORDER_DOCUMENT_MIMES;

const MB = 1024 * 1024;
export const ORDER_FILE_LIMITS = {
  documentBytes: 10 * MB,
  imageBytes: 5 * MB,
  /** Per draft and per order (spec B9). */
  filesPerOrder: 20,
  /** China form screenshots (spec B5). */
  screenshotsPerOrder: 10,
  /** Uploads waiting for an order (drafts of the 3 services + not yet saved). */
  pendingPerCustomer: 60,
} as const;

export const isImageMime = (mime: string) =>
  (ORDER_IMAGE_MIMES as readonly string[]).includes(mime);

/** Screenshots are images only; every other purpose takes any document type. */
export const allowedOrderMimes = (purpose: OrderUploadPurpose): readonly OrderMime[] =>
  purpose === 'screenshot' ? ORDER_IMAGE_MIMES : ORDER_DOCUMENT_MIMES;

/** File extension used for storage and downloads. */
export const ORDER_EXTENSIONS: Record<OrderMime, string> = {
  'application/pdf': 'pdf',
  [DOCX]: 'docx',
  [XLSX]: 'xlsx',
  [DOC]: 'doc',
  [XLS]: 'xls',
  'text/csv': 'csv',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** i18n key of the problem with a file, or null when it is accepted. */
export function checkOrderFile(
  file: { size: number; mime: string | null },
  purpose: OrderUploadPurpose,
): string | null {
  const allowed = allowedOrderMimes(purpose) as readonly string[];
  if (!file.mime || !allowed.includes(file.mime)) {
    return purpose === 'screenshot' ? 'validation.screenshotType' : 'validation.orderFileType';
  }
  const max = isImageMime(file.mime)
    ? ORDER_FILE_LIMITS.imageBytes
    : ORDER_FILE_LIMITS.documentBytes;
  if (file.size === 0 || file.size > max) return 'validation.orderFileSize';
  return null;
}

// ── content detection ────────────────────────────────────────────────────────

const ZIP_LOCAL = 0x04034b50; // "PK\3\4"
const ZIP_END = 0x06054b50; // end of central directory
const ZIP_ENTRY = 0x02014b50; // central directory file header
const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/**
 * Names of the entries of a ZIP file, read from its central directory (no decompression).
 * null when it is not a well-formed (non-ZIP64) archive.
 */
export function zipEntryNames(bytes: Uint8Array): string[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 22 || view.getUint32(0, true) !== ZIP_LOCAL) return null;
  // the end record is in the last 22 + 65535 (comment) bytes
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === ZIP_END) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  if (count === 0xffff || offset === 0xffffffff) return null; // ZIP64: not used by Office files this size
  const decoder = new TextDecoder();
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== ZIP_ENTRY) return null;
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    if (offset + 46 + nameLength > bytes.length) return null;
    names.push(decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

const extensionOf = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';

function isUtf8Text(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * The real type of a whole file (decision 25):
 * - PDF / JPG / PNG / WEBP by signature;
 * - DOCX / XLSX: a ZIP with the Office main part, refused when it carries macros
 *   (`vbaProject.bin`);
 * - DOC / XLS: the OLE2 signature, told apart by the extension (both share the container);
 * - CSV: `.csv` with valid UTF-8 text and no NUL bytes.
 * Anything else → null.
 */
export function detectOrderMime(bytes: Uint8Array, fileName: string): OrderMime | null {
  const simple = detectMime(bytes.subarray(0, 16));
  if (simple) return simple;

  const zip = zipEntryNames(bytes);
  if (zip) {
    if (zip.some((name) => name.toLowerCase().endsWith('vbaproject.bin'))) return null;
    if (zip.includes('word/document.xml')) return DOCX;
    if (zip.includes('xl/workbook.xml')) return XLSX;
    return null;
  }

  const extension = extensionOf(fileName);
  if (OLE2.every((byte, i) => bytes[i] === byte)) {
    return extension === 'doc' ? DOC : extension === 'xls' ? XLS : null;
  }
  if (extension === 'csv' && bytes.length > 0 && isUtf8Text(bytes)) return 'text/csv';
  return null;
}

/** An uploaded attachment, as the API returns it (never the storage location). */
export type UploadedFile = {
  id: string;
  purpose: OrderUploadPurpose;
  name: string;
  mime: OrderMime;
  size: number;
  createdAt: string;
};
