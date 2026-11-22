import type {
  OrderDraft,
  OrderDraftInput,
  OrderUploadPurpose,
  ServiceType,
  UploadedFile,
} from '@mirhalgo/shared';
import { apiRequest, apiUpload } from '../../lib/apiClient';

/*
 * New Request orders (MW_003, real API): server drafts (B3), attachments uploaded before submit
 * (B3), submit + read (B4).
 */

const auth = { auth: true } as const;

export const ordersApi = {
  getDraft: (service: ServiceType) =>
    apiRequest<OrderDraft | null>('GET', `/orders/drafts/${service}`, auth),
  saveDraft: (service: ServiceType, body: OrderDraftInput) =>
    apiRequest<{ updatedAt: string }>('PUT', `/orders/drafts/${service}`, { body, auth: true }),
  discardDraft: (service: ServiceType) =>
    apiRequest<null>('DELETE', `/orders/drafts/${service}`, auth),

  /** One file per request, with its own progress (0–100). */
  uploadFile: (file: File, purpose: OrderUploadPurpose, onProgress?: (percent: number) => void) => {
    const body = new FormData();
    body.append('purpose', purpose);
    body.append('file', file, file.name);
    return apiUpload<UploadedFile>('/uploads', body, onProgress, auth);
  },
  deleteUpload: (id: string) => apiRequest<null>('DELETE', `/uploads/${id}`, auth),
};
