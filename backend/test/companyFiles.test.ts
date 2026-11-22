import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  cleanOriginalName,
  prepareFiles,
  type IncomingFile,
} from '../src/services/companyFiles.js';

/* Real files through real sharp: content checks, re-encoding, limits (decision 5). */

const MB = 1024 * 1024;
const file = (buffer: Buffer, originalname = 'doc.bin'): IncomingFile[] => [
  { buffer, originalname, size: buffer.length },
];

const png = (width = 64, height = 64) =>
  sharp({ create: { width, height, channels: 3, background: { r: 37, g: 99, b: 235 } } })
    .png()
    .toBuffer();
const jpegWithExif = () =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: '#0B1B35' } })
    .jpeg()
    .withExif({ IFD0: { Make: 'SecretCam', Copyright: 'GPS 30.0444,31.2357' } })
    .toBuffer();
const pdf = Buffer.from('%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF');

async function required() {
  return { commercial_register: file(pdf, 'cr.pdf'), tax_card: file(pdf, 'tax.pdf') };
}

async function errorCode(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return 'NO_ERROR';
}

describe('prepareFiles', () => {
  it('requires the commercial register and tax card', async () => {
    expect(await errorCode(prepareFiles({ commercial_register: file(pdf) }))).toBe('FILE_REQUIRED');
    expect(await errorCode(prepareFiles(undefined))).toBe('FILE_REQUIRED');
  });

  it('keeps PDFs byte for byte (never parsed) and orders by document type', async () => {
    const files = await prepareFiles({ tax_card: file(pdf, 'tax.pdf'), ...(await required()) });
    expect(files.map((f) => f.type)).toEqual(['commercial_register', 'tax_card']);
    expect(files[0]).toMatchObject({ mime: 'application/pdf', extension: 'pdf', size: pdf.length });
    expect(files[0]!.buffer.equals(pdf)).toBe(true);
  });

  it('uses the real content, not the file name', async () => {
    const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100)]);
    expect(
      await errorCode(prepareFiles({ ...(await required()), tax_card: file(exe, 'tax.pdf') })),
    ).toBe('FILE_TYPE_NOT_ALLOWED');
    // a real PNG named .pdf is accepted as a PNG
    const files = await prepareFiles({
      ...(await required()),
      tax_card: file(await png(), 'tax.pdf'),
    });
    expect(files[1]).toMatchObject({ mime: 'image/png', extension: 'png' });
  });

  it('rejects WEBP for legal documents and PDF for the logo', async () => {
    const webp = await sharp(await png())
      .webp()
      .toBuffer();
    expect(
      await errorCode(prepareFiles({ ...(await required()), customs_license: file(webp) })),
    ).toBe('FILE_TYPE_NOT_ALLOWED');
    expect(await errorCode(prepareFiles({ ...(await required()), logo: file(pdf) }))).toBe(
      'FILE_TYPE_NOT_ALLOWED',
    );
  });

  it('rejects a fake image (valid signature, corrupt content)', async () => {
    const fake = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(200, 7),
    ]);
    expect(
      await errorCode(prepareFiles({ ...(await required()), customs_license: file(fake) })),
    ).toBe('FILE_TYPE_NOT_ALLOWED');
  });

  it('strips EXIF metadata from images', async () => {
    const original = await jpegWithExif();
    expect(original.includes('SecretCam')).toBe(true);
    const [, , license] = await prepareFiles({
      ...(await required()),
      customs_license: file(original),
    });
    expect(license!.mime).toBe('image/jpeg');
    expect(license!.buffer.includes('SecretCam')).toBe(false);
    expect((await sharp(license!.buffer).metadata()).exif).toBeUndefined();
  });

  it('drops data appended to an image (polyglot)', async () => {
    const polyglot = Buffer.concat([
      await png(),
      Buffer.from('<script>alert(1)</script>PK\u0003\u0004'),
    ]);
    const [, , license] = await prepareFiles({
      ...(await required()),
      customs_license: file(polyglot),
    });
    expect(license!.buffer.includes('<script>')).toBe(false);
  });

  it('turns the logo into a 512×512 WEBP', async () => {
    const [, , logo] = await prepareFiles({
      ...(await required()),
      logo: file(await png(300, 200), 'logo.png'),
    });
    expect(logo).toMatchObject({ type: 'logo', mime: 'image/webp', extension: 'webp' });
    expect(await sharp(logo!.buffer).metadata()).toMatchObject({
      width: 512,
      height: 512,
      format: 'webp',
    });
  });

  it('enforces the per-type size limits (logo 2 MB, documents 5 MB)', async () => {
    const big = (bytes: number) => Buffer.concat([pdf, Buffer.alloc(bytes - pdf.length)]);
    expect(
      await errorCode(prepareFiles({ ...(await required()), tax_card: file(big(5 * MB + 1)) })),
    ).toBe('FILE_TOO_LARGE');
    expect(
      await errorCode(prepareFiles({ ...(await required()), tax_card: file(big(5 * MB)) })),
    ).toBe('NO_ERROR');
    const bigPng = Buffer.concat([await png(), Buffer.alloc(2 * MB)]);
    expect(await errorCode(prepareFiles({ ...(await required()), logo: file(bigPng) }))).toBe(
      'FILE_TOO_LARGE',
    );
  });

  it('refuses decompression bombs', async () => {
    const huge = await sharp({
      create: { width: 10_000, height: 6_000, channels: 3, background: '#fff' },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(huge.length).toBeLessThan(5 * MB);
    expect(
      await errorCode(prepareFiles({ ...(await required()), customs_license: file(huge) })),
    ).toBe('FILE_TYPE_NOT_ALLOWED');
  });
});

describe('cleanOriginalName', () => {
  it('decodes UTF-8 names sent as latin1 by busboy', () => {
    const latin1 = Buffer.from('سجل تجاري.pdf', 'utf8').toString('latin1');
    expect(cleanOriginalName(latin1, 'x.pdf')).toBe('سجل تجاري.pdf');
  });

  it('keeps plain latin1 names and removes paths + control characters', () => {
    expect(cleanOriginalName('../../etc/passwd', 'x')).toBe('passwd');
    expect(cleanOriginalName('C:\\Users\\me\\tax.pdf', 'x')).toBe('tax.pdf');
    expect(cleanOriginalName('a\u0000b\nc.pdf', 'x')).toBe('abc.pdf');
    expect(cleanOriginalName('   ', 'fallback.pdf')).toBe('fallback.pdf');
    expect(cleanOriginalName('x'.repeat(300), 'f').length).toBe(255);
  });
});
