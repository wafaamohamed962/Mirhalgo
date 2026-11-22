import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Arabic copy rules (MW_003 A1, CLAUDE.md §7): formal Modern Standard Arabic everywhere, no
 * colloquial words, no English words written in Arabic letters, and no Arabic text hard-coded in
 * code: only the i18n files (web `src/i18n`, backend `src/i18n` for the emails). Mock data is the
 * one exception (it stands in for user content).
 */

// The repo root (this file is frontend/test/…): the Arabic sources span frontend/ and backend/.
const root = resolve(__dirname, '../..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

/** Every file that contains user-facing Arabic. */
const ARABIC_SOURCES = [
  'frontend/src/i18n/ar.json',
  'frontend/src/i18n/portal/ar.json',
  'frontend/index.html',
  'frontend/src/mocks/fixtures.ts',
  'backend/src/i18n/ar.json',
];

/**
 * Colloquial Egyptian words and English words written in Arabic letters. Each is matched as a
 * whole word (optionally with و / ف / ب / ل / ال in front), so "دي" never matches "يُعاد".
 * Brand and product names (واتساب، فيسبوك، شي إن…) are proper nouns and allowed. Words that are
 * also valid MSA (e.g. "دول" = countries) are left out.
 */
const COLLOQUIAL =
  'حاجة حاجات عايز عايزة عاوز إزاي ازاي دلوقتي كده كدا بتاع بتاعة بتاعك بتاعتك ده ' +
  'دي مش مفيش علشان عشان ليه إيه ايه اللي بقى خلاص كمان برضه يلا بس لسه شوية ' +
  'أوي امشي خليك عربيات عربيتك هنبعت هتوصل هيوصل ابعت بنبعت اتفضل';
const TRANSLITERATED =
  'إيميل ايميل باسورد كود أكواد لوجو لينك لينكات أونلاين اونلاين أكاونت اكاونت ' +
  'داشبورد بروفايل أوردر اوردر أوردرات كونتينر كونتينرات تراكينج سكرين سكرينشوت ' +
  'أبلود ابلود داونلود كاش كارجو سيستم أوكي فورم ستيب';
const DENIED = [...COLLOQUIAL.split(' '), ...TRANSLITERATED.split(' ')];

/** Removes diacritics and tatweel so "كودًا" is still caught as "كود". */
const plain = (text: string) => text.replace(/[\u064B-\u0652\u0640]/g, '');
const PREFIXES = ['', 'و', 'ف', 'ب', 'ل', 'ال', 'وال', 'بال', 'فال', 'لل'];
const denied = new Set(DENIED.flatMap((word) => PREFIXES.map((prefix) => prefix + word)));

function deniedWords(text: string) {
  const words = plain(text).match(/[\u0621-\u064A]+/g) ?? [];
  return [...new Set(words.filter((word) => denied.has(word)))];
}

/** Code files under `dir`, recursively. */
const codeFiles = (dir: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return codeFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });

const withoutComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`])\/\/.*$/gm, '$1');

describe('Arabic copy (MSA)', () => {
  it.each(ARABIC_SOURCES)('%s has no colloquial or transliterated words', (file) => {
    expect(deniedWords(read(file))).toEqual([]);
  });

  it('the checker catches colloquial words, with prefixes and diacritics', () => {
    expect(deniedWords('اكتب الكودَ ده علشان نبعته')).toEqual(['الكود', 'ده', 'علشان']);
    expect(deniedWords('هل يُعاد الطلب إلى رصيدي؟ تم حفظ التفضيلات.')).toEqual([]);
  });

  it('no Arabic text is hard-coded in code, web or backend (i18n files only)', () => {
    const files = [
      ...codeFiles('frontend/src'),
      ...codeFiles('shared/src'),
      ...codeFiles('backend/src'),
    ].filter((file) => !file.startsWith('frontend/src/mocks/'));
    const offenders = files.filter((file) => /[\u0621-\u064A]/.test(withoutComments(read(file))));
    expect(offenders).toEqual([]);
  });
});
