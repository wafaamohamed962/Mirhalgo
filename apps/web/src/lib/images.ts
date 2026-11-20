import generated from './images.json';

/**
 * Landing-page images (spec 3.4). Originals live in src/assets/images/ (never bundled);
 * `npm run images -w apps/web` exports AVIF + WebP at 640/1280/1920/3840 px (never upscaled)
 * to public/images/ and writes images.json (intrinsic size + available widths).
 * Every image must be recorded in docs/image-credits.md.
 */
export type ImageName = 'hero' | 'about' | 'international' | 'domestic' | 'china';

export type ImageAsset = {
  /** File name prefix inside /public/images. */
  name: ImageName;
  /** Intrinsic size of the source, used to reserve space (no layout shift). */
  width: number;
  height: number;
  /** Exported widths (≤ source width). */
  widths: readonly number[];
};

const manifest: Record<ImageName, Omit<ImageAsset, 'name'>> = generated;

export const IMAGES = Object.fromEntries(
  Object.entries(manifest).map(([name, meta]) => [name, { name, ...meta }]),
) as Record<ImageName, ImageAsset>;

export function srcSet({ name, widths }: ImageAsset, format: 'avif' | 'webp'): string {
  return widths.map((w) => `/images/${name}-${w}.${format} ${w}w`).join(', ');
}

/** Fallback `src` for browsers without srcset support: a mid-size WebP. */
export function fallbackSrc({ name, widths }: ImageAsset): string {
  const width = widths.find((w) => w >= 1280) ?? widths[widths.length - 1];
  return `/images/${name}-${width}.webp`;
}
