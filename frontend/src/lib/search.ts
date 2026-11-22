/**
 * Forgiving text search (reference pickers, MW_003 B1): case-insensitive, without Arabic
 * diacritics/tatweel, with Arabic letter variants folded (أ إ آ ٱ → ا, ة → ه, ى → ي) and
 * Latin accents removed ("São" → "sao"). Arabic-Indic digits become ASCII.
 */
export function normalizeSearch(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Latin accents
      // Arabic diacritics, the hamza/madda that NFD splits off أ إ آ (U+0653–0655), tatweel
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627') // أ إ آ ٱ → ا
      .replace(/\u0629/g, '\u0647') // ة → ه
      .replace(/\u0649/g, '\u064A') // ى → ي
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Every word of `query` appears somewhere in `haystack` (both normalised). */
export function matchesSearch(haystack: string, query: string): boolean {
  const text = normalizeSearch(haystack);
  return normalizeSearch(query)
    .split(' ')
    .every((word) => text.includes(word));
}
