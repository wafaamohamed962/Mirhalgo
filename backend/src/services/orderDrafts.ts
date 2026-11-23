import { z } from 'zod';
import {
  SERVICE_TYPES,
  type OrderDraft,
  type RequestDraft,
  type ServiceType,
  orderDraftSchema,
} from '@mirhalgo/shared';
import { db } from '../lib/supabase.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { AuthUser } from '../middleware/requireAuth.js';
import { ORDER_BUCKET, toUploadedFile } from './orderUploads.js';
import { removeFiles } from './storage.js';

/*
 * GET / PUT / DELETE /api/orders/drafts/:service (MW_003 B3, spec B2 "Drafts"): one draft per
 * customer and service, saved on the server (works across devices), never touching the
 * balance. The SQL function attaches exactly the listed files in the same transaction.
 */

const serviceSchema = z.enum(SERVICE_TYPES);
const CHECK_VIOLATION = '23514';

/** `:service` from the URL; anything else is a 404. */
export function parseService(raw: unknown): ServiceType {
  const service = serviceSchema.safeParse(raw);
  if (!service.success) throw new HttpError(404, 'NOT_FOUND', 'Not found');
  return service.data;
}

async function findDraft(customerId: string, service: ServiceType) {
  const { data, error } = await db
    .from('order_drafts')
    .select('id, service, payload, form_version, updated_at')
    .eq('customer_id', customerId)
    .eq('service', service)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getDraft(user: AuthUser, service: ServiceType): Promise<OrderDraft | null> {
  const draft = await findDraft(user.id, service);
  if (!draft) return null;
  const { data: uploads, error } = await db
    .from('order_uploads')
    .select('*')
    .eq('draft_id', draft.id)
    .order('created_at');
  if (error) throw error;
  return {
    service: draft.service,
    payload: draft.payload,
    formVersion: draft.form_version,
    uploads: uploads.map(toUploadedFile),
    updatedAt: draft.updated_at,
  };
}

export async function saveDraft(
  user: AuthUser,
  service: ServiceType,
  input: z.output<typeof orderDraftSchema>,
): Promise<{ updatedAt: string }> {
  const { data, error } = await db
    .rpc('save_order_draft', {
      p_customer_id: user.id,
      p_service: service,
      p_payload: input.payload,
      p_form_version: input.formVersion,
      p_upload_ids: input.uploadIds,
    })
    .single();
  // a file that is not this customer's / already in an order / in another draft, or too many
  if (error?.code === CHECK_VIOLATION)
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid input');
  if (error) throw error;
  return { updatedAt: data.updated_at };
}

/** "Discard": the draft and its files go now (not after 24 h). Idempotent. */
export async function discardDraft(user: AuthUser, service: ServiceType): Promise<void> {
  const draft = await findDraft(user.id, service);
  if (!draft) return;
  await deleteDraftWithFiles(draft.id);
}

/** Files first (kept for a retry if storage fails), then the rows. */
export async function deleteDraftWithFiles(draftId: string): Promise<boolean> {
  const { data: uploads, error } = await db
    .from('order_uploads')
    .select('id, storage_path')
    .eq('draft_id', draftId);
  if (error) throw error;
  if (!(await removeFiles(uploads.map((u) => ({ bucket: ORDER_BUCKET, path: u.storage_path }))))) {
    return false;
  }
  if (uploads.length) {
    const removed = await db
      .from('order_uploads')
      .delete()
      .in(
        'id',
        uploads.map((u) => u.id),
      );
    if (removed.error) throw removed.error;
  }
  const deleted = await db.from('order_drafts').delete().eq('id', draftId);
  if (deleted.error) throw deleted.error;
  return true;
}

/** The drafts listed on the New Request page (GET /me/summary), most recent first. */
export async function listDraftSummaries(customerId: string): Promise<RequestDraft[]> {
  const { data, error } = await db
    .from('order_drafts')
    .select('service, updated_at')
    .eq('customer_id', customerId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data.map((row) => ({ service: row.service, updatedAt: row.updated_at }));
}
