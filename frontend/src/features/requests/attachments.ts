import { checkOrderFile, detectOrderMime, type OrderUploadPurpose } from '@mirhalgo/shared';

/** Same rules as the server, on the whole file (Office files are recognised by content). */
export async function checkPickedOrderFile(
  file: File,
  purpose: OrderUploadPurpose,
): Promise<string | null> {
  const mime = detectOrderMime(new Uint8Array(await file.arrayBuffer()), file.name);
  return checkOrderFile({ size: file.size, mime }, purpose);
}
