import { fallbackSrc, srcSet, type ImageAsset } from '../../lib/images';
import { cn } from '../../lib/utils';

type ResponsiveImageProps = {
  image: ImageAsset;
  alt: string;
  /** e.g. "100vw" for the hero, "(min-width: 1024px) 33vw, 100vw" for cards. */
  sizes: string;
  /** Hero only: eager load + high fetch priority. Everything else lazy-loads. */
  priority?: boolean;
  className?: string;
};

/** AVIF/WebP <picture> with srcset 640/1280/1920/3840 (spec 3.4), lazy below the hero. */
export function ResponsiveImage({
  image,
  alt,
  sizes,
  priority = false,
  className,
}: ResponsiveImageProps) {
  return (
    <picture>
      <source type="image/avif" srcSet={srcSet(image, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(image, 'webp')} sizes={sizes} />
      <img
        src={fallbackSrc(image)}
        alt={alt}
        width={image.width}
        height={image.height}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        // React 18 does not know `fetchPriority` yet; the lowercase attribute passes through.
        {...{ fetchpriority: priority ? 'high' : 'auto' }}
        className={cn('object-cover', className)}
      />
    </picture>
  );
}
