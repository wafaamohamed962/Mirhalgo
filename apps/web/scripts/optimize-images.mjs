/**
 * Generates the responsive landing images (spec 3.4): AVIF + WebP at 640/1280/1920/3840 px
 * from the original photos in src/assets/images/. Never upscales: widths above the source
 * width are skipped. Output: public/images/<name>-<width>.<avif|webp> + src/lib/images.json
 * (intrinsic size + available widths, read by src/lib/images.ts).
 *
 * Run after adding or replacing an image:  npm run images -w apps/web
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = join(root, 'src/assets/images');
const OUT_DIR = join(root, 'public/images');
const MANIFEST = join(root, 'src/lib/images.json');

const WIDTHS = [640, 1280, 1920, 3840];
/** Quality tuned for photos: visually clean, small files. */
const ENCODERS = {
  avif: (image) => image.avif({ quality: 50, effort: 6 }),
  webp: (image) => image.webp({ quality: 72, effort: 5 }),
};

/** name → original file (relative to src/assets/images). */
const SOURCES = {
  hero: 'hero/hero.jpg',
  about: 'about/about.jpg',
  international: 'services/international.jpg',
  domestic: 'services/domestic.jpg',
  china: 'services/china.jpg',
};

await mkdir(OUT_DIR, { recursive: true });
const manifest = {};

for (const [name, file] of Object.entries(SOURCES)) {
  // .rotate() applies the EXIF orientation (phone photos), so width/height are the real ones
  const source = sharp(join(SOURCE_DIR, file)).rotate();
  const { width, height } = await source
    .clone()
    .toBuffer({ resolveWithObject: true })
    .then(({ info }) => info);
  const widths = WIDTHS.filter((w) => w <= width);

  for (const w of widths) {
    for (const [format, encode] of Object.entries(ENCODERS)) {
      await encode(source.clone().resize({ width: w })).toFile(
        join(OUT_DIR, `${name}-${w}.${format}`),
      );
    }
  }
  manifest[name] = { width, height, widths };
  console.log(`${name.padEnd(14)} ${width}×${height} → ${widths.join(', ')}`);
}

await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `\nWrote ${Object.keys(manifest).length} images to public/images and src/lib/images.json`,
);
