/**
 * Upload rules for company documents (spec A2 Step 3 + A5). The web uses them for instant
 * feedback; the API enforces them on the real file content (magic bytes), never on the
 * extension or the MIME type sent by the client.
 */

export const DOCUMENT_TYPES = [
  'commercial_register',
  'tax_card',
  'customs_license',
  'logo',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type AllowedMime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

const MB = 1024 * 1024;

type FileRule = {
  mimes: readonly AllowedMime[];
  maxBytes: number;
  required: boolean;
  /** i18n keys shown when the type / size is wrong. */
  typeError: string;
  sizeError: string;
};

const legalDocument = (required: boolean): FileRule => ({
  mimes: ['application/pdf', 'image/jpeg', 'image/png'],
  maxBytes: 5 * MB,
  required,
  typeError: 'validation.fileType',
  sizeError: 'validation.fileSize',
});

export const FILE_RULES: Record<DocumentType, FileRule> = {
  commercial_register: legalDocument(true),
  tax_card: legalDocument(true),
  customs_license: legalDocument(false),
  logo: {
    mimes: ['image/png', 'image/jpeg', 'image/webp'],
    maxBytes: 2 * MB,
    required: false,
    typeError: 'validation.logoType',
    sizeError: 'validation.logoSize',
  },
};

/** One file per document type (spec A5: max 4 files per request). */
export const MAX_UPLOAD_FILES = DOCUMENT_TYPES.length;

/**
 * Checks a file's type and size against its rule. Returns an i18n key, or null when valid.
 * `mime` is the detected type on the server, the browser-reported type on the client.
 */
export function checkFile(
  file: { size: number; mime: string | null },
  type: DocumentType,
): string | null {
  const rule = FILE_RULES[type];
  if (!file.mime || !(rule.mimes as readonly string[]).includes(file.mime)) return rule.typeError;
  if (file.size === 0 || file.size > rule.maxBytes) return rule.sizeError;
  return null;
}

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  bytes.length >= offset + signature.length &&
  signature.every((byte, i) => bytes[offset + i] === byte);

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const RIFF = [0x52, 0x49, 0x46, 0x46]; // "RIFF" … "WEBP" at offset 8
const WEBP = [0x57, 0x45, 0x42, 0x50];

/** Detects the real type from the first bytes of the file (magic bytes). */
export function detectMime(bytes: Uint8Array): AllowedMime | null {
  if (startsWith(bytes, PDF)) return 'application/pdf';
  if (startsWith(bytes, PNG)) return 'image/png';
  if (startsWith(bytes, JPEG)) return 'image/jpeg';
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return 'image/webp';
  return null;
}
