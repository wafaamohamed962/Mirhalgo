import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/* MW_004 spec B10: user content is never rendered as raw HTML in the company portal. */

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });

describe('no raw HTML', () => {
  it('the company portal, its shell and its mocks never use dangerouslySetInnerHTML', () => {
    const sources = [
      ...files('src/features/companyPortal'),
      ...files('src/components/portal'),
      ...files('src/mocks/company'),
    ];
    expect(sources.length).toBeGreaterThan(20);
    for (const file of sources)
      expect(readFileSync(file, 'utf8')).not.toContain('dangerouslySetInnerHTML');
  });
});
