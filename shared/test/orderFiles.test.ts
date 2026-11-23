import { describe, expect, it } from 'vitest';
import { DOCX, XLSX, checkOrderFile, detectOrderMime, zipEntryNames } from '../src/index.js';

/* Order attachments (MW_003 B3, decision 25): type from the content, never the extension. */

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

/** A minimal stored ZIP (no data) whose central directory lists `names`. */
function zip(names: string[]): Uint8Array {
  const parts: number[] = [0x50, 0x4b, 0x03, 0x04, ...new Array(26).fill(0)]; // local header stub
  const cdOffset = parts.length;
  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const u32 = (n: number) => [...u16(n & 0xffff), ...u16(n >>> 16)];
  for (const name of names) {
    const bytes = ascii(name);
    parts.push(0x50, 0x4b, 0x01, 0x02, ...new Array(24).fill(0), ...u16(bytes.length), 0, 0, 0, 0);
    parts.push(...new Array(12).fill(0), ...bytes);
  }
  const cdSize = parts.length - cdOffset;
  parts.push(0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, ...u16(names.length), ...u16(names.length));
  parts.push(...u32(cdSize), ...u32(cdOffset), 0, 0);
  return new Uint8Array(parts);
}

describe('detectOrderMime', () => {
  it('PDF and images by signature, whatever the name', () => {
    expect(detectOrderMime(new Uint8Array(ascii('%PDF-1.7')), 'x.xlsx')).toBe('application/pdf');
    expect(detectOrderMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 'a.pdf')).toBe('image/jpeg');
  });

  it('DOCX / XLSX from the ZIP entries; macros and other ZIPs refused', () => {
    expect(zipEntryNames(zip(['[Content_Types].xml', 'word/document.xml']))).toHaveLength(2);
    expect(detectOrderMime(zip(['word/document.xml']), 'a.docx')).toBe(DOCX);
    expect(detectOrderMime(zip(['xl/workbook.xml']), 'renamed.pdf')).toBe(XLSX);
    expect(detectOrderMime(zip(['xl/workbook.xml', 'xl/vbaProject.bin']), 'm.xlsx')).toBeNull();
    expect(detectOrderMime(zip(['payload.exe']), 'a.docx')).toBeNull();
    expect(detectOrderMime(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2]), 'a.docx')).toBeNull();
  });

  it('DOC / XLS: OLE2 signature + extension', () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0]);
    expect(detectOrderMime(ole, 'old.doc')).toBe('application/msword');
    expect(detectOrderMime(ole, 'old.XLS')).toBe('application/vnd.ms-excel');
    expect(detectOrderMime(ole, 'mail.msg')).toBeNull();
  });

  it('CSV: .csv with valid UTF-8 text and no NUL bytes', () => {
    const csv = new TextEncoder().encode('المنتج,الكمية\nقميص,3\n');
    expect(detectOrderMime(csv, 'list.csv')).toBe('text/csv');
    expect(detectOrderMime(csv, 'list.txt')).toBeNull();
    expect(detectOrderMime(new Uint8Array([0x61, 0, 0x62]), 'x.csv')).toBeNull();
    expect(detectOrderMime(new Uint8Array([0xff, 0xfe, 0x41]), 'x.csv')).toBeNull();
  });
});

describe('checkOrderFile', () => {
  const MB = 1024 * 1024;
  it('screenshots are images only; documents 10 MB, images 5 MB', () => {
    expect(checkOrderFile({ size: 100, mime: 'application/pdf' }, 'screenshot')).toBe(
      'validation.screenshotType',
    );
    expect(checkOrderFile({ size: 5 * MB, mime: 'image/png' }, 'screenshot')).toBeNull();
    expect(checkOrderFile({ size: 5 * MB + 1, mime: 'image/png' }, 'document')).toBe(
      'validation.orderFileSize',
    );
    expect(checkOrderFile({ size: 10 * MB, mime: XLSX }, 'packing_list')).toBeNull();
    expect(checkOrderFile({ size: 10 * MB + 1, mime: XLSX }, 'packing_list')).toBe(
      'validation.orderFileSize',
    );
    expect(checkOrderFile({ size: 100, mime: null }, 'msds')).toBe('validation.orderFileType');
  });
});
