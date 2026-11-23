import sharp from 'sharp';

/*
 * Image re-encoding (MW_002 decision 5, reused for order attachments in MW_003 B3): decoding
 * and encoding again drops EXIF/GPS metadata and anything appended to the image (polyglot
 * files). Throws when the content is not really an image.
 */

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

/** Large photos of documents are scaled down (still readable) to stay under the limits. */
const MAX_IMAGE_SIDE = 4000;
/** Decompression-bomb guard: refuse images above ~50 megapixels before decoding. */
const MAX_INPUT_PIXELS = 50_000_000;

/**
 * Same format back (JPEG / PNG / WEBP), at most 4000 px per side. `square` crops to a
 * square WEBP of that size instead (company logo).
 */
export async function reencodeImage(
  buffer: Buffer,
  mime: ImageMime,
  { square }: { square?: number } = {},
): Promise<{ buffer: Buffer; mime: ImageMime }> {
  const image = sharp(buffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS }).rotate();

  if (square) {
    const out = await image
      .resize(square, square, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();
    return { buffer: out, mime: 'image/webp' };
  }

  const resized = image.resize(MAX_IMAGE_SIDE, MAX_IMAGE_SIDE, {
    fit: 'inside',
    withoutEnlargement: true,
  });
  const encoded =
    mime === 'image/png'
      ? resized.png({ compressionLevel: 9 })
      : mime === 'image/webp'
        ? resized.webp({ quality: 85 })
        : resized.jpeg({ quality: 85, mozjpeg: true });
  return { buffer: await encoded.toBuffer(), mime };
}
