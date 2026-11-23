import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  ORDER_EXTENSIONS,
  ORDER_FILE_LIMITS,
  ORDER_UPLOAD_PURPOSES,
  checkOrderFile,
  detectOrderMime,
  isImageMime,
  type OrderMime,
  type UploadedFile,
} from '@mirhalgo/shared';
import { db } from '../lib/supabase.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { AuthUser } from '../middleware/requireAuth.js';
import type { OrderUploadRow } from '../types/database.js';
import { cleanOriginalName, type IncomingFile } from './companyFiles.js';
import { reencodeImage, type ImageMime } from './images.js';
import { removeFiles } from './storage.js';

/*
 * POST /api/uploads + DELETE /api/uploads/:id (MW_003 B3, spec B7 "Uploads", B9).
 * One file per request, uploaded before submit. The type comes from the content (shared
 * detectOrderMime: never the extension or the client MIME); images are re-encoded; documents
 * are never opened. Files live in the private bucket under random names.
 */

export const ORDER_BUCKET = 'order-attachments';

const purposeSchema = z.enum(ORDER_UPLOAD_PURPOSES);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const typeNotAllowed = () => new HttpError(400, 'FILE_TYPE_NOT_ALLOWED', 'File type not allowed');
const tooLarge = () => new HttpError(413, 'FILE_TOO_LARGE', 'File too large');
const notFound = () => new HttpError(404, 'NOT_FOUND', 'Not found');

export const toUploadedFile = (row: OrderUploadRow): UploadedFile => ({
  id: row.id,
  purpose: row.purpose,
  name: row.original_name,
  mime: row.mime_type,
  size: row.size_bytes,
  createdAt: row.created_at,
});

/** Content check + image re-encoding. Returns what is stored. */
async function prepare(purpose: z.infer<typeof purposeSchema>, file: IncomingFile) {
  const name = cleanOriginalName(file.originalname, 'file');
  const bytes = new Uint8Array(file.buffer.buffer, file.buffer.byteOffset, file.buffer.byteLength);
  let mime: OrderMime | null = detectOrderMime(bytes, name);
  const problem = checkOrderFile({ size: file.size, mime }, purpose);
  if (problem) throw problem === 'validation.orderFileSize' ? tooLarge() : typeNotAllowed();

  let buffer = file.buffer;
  if (mime && isImageMime(mime)) {
    try {
      ({ buffer, mime } = await reencodeImage(buffer, mime as ImageMime));
    } catch {
      throw typeNotAllowed(); // corrupt / not really an image
    }
    if (buffer.length > ORDER_FILE_LIMITS.imageBytes) throw tooLarge();
  }
  return { buffer, mime: mime as OrderMime, name };
}

export async function uploadOrderFile(
  user: AuthUser,
  rawPurpose: unknown,
  file: IncomingFile | undefined,
): Promise<UploadedFile> {
  const purpose = purposeSchema.safeParse(rawPurpose);
  if (!purpose.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid input');
  if (!file) throw new HttpError(400, 'FILE_REQUIRED', 'A file is required');

  const pending = await db
    .from('order_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', user.id)
    .is('order_id', null);
  if (pending.error) throw pending.error;
  if ((pending.count ?? 0) >= ORDER_FILE_LIMITS.pendingPerCustomer) {
    throw new HttpError(400, 'TOO_MANY_FILES', 'Too many files');
  }

  const { buffer, mime, name } = await prepare(purpose.data, file);
  const storagePath = `${user.id}/${randomUUID()}.${ORDER_EXTENSIONS[mime]}`;
  const stored = await db.storage
    .from(ORDER_BUCKET)
    .upload(storagePath, buffer, { contentType: mime, upsert: false });
  if (stored.error) throw stored.error;

  const { data, error } = await db
    .from('order_uploads')
    .insert({
      customer_id: user.id,
      purpose: purpose.data,
      storage_path: storagePath,
      original_name: name,
      mime_type: mime,
      size_bytes: buffer.length,
    })
    .select('*')
    .single();
  if (error) {
    await removeFiles([{ bucket: ORDER_BUCKET, path: storagePath }]);
    throw error;
  }
  return toUploadedFile(data);
}

/** Removes a file that is not part of an order yet (own files only). */
export async function deleteOrderUpload(user: AuthUser, id: string): Promise<void> {
  if (!UUID.test(id)) throw notFound();
  const { data, error } = await db
    .from('order_uploads')
    .select('id, storage_path')
    .eq('id', id)
    .eq('customer_id', user.id)
    .is('order_id', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  if (!(await removeFiles([{ bucket: ORDER_BUCKET, path: data.storage_path }]))) {
    throw new Error('uploads: could not remove the file');
  }
  const deleted = await db.from('order_uploads').delete().eq('id', data.id);
  if (deleted.error) throw deleted.error;
}
