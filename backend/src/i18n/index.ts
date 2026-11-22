import ar from './ar.json' with { type: 'json' };
import en from './en.json' with { type: 'json' };

/*
 * Backend copy (emails), MW_003 A1: all Arabic and English text lives in `ar.json` / `en.json`,
 * like the web app. `{{name}}` placeholders, same syntax as i18next. No library: the API only
 * needs lookup + interpolation.
 */

export const LANGS = ['ar', 'en'] as const;
export type Lang = (typeof LANGS)[number];

type Tree = { [key: string]: string | Tree };

/** Dotted paths to the strings of a translation tree, e.g. "email.otp.signup.title". */
type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`;
}[keyof T & string];

export type TranslationKey = Paths<typeof en>;
/** Field labels of the team-inbox emails. */
export type EmailLabel = keyof typeof en.email.labels;
export type TranslationVars = Record<string, string | number>;

// `satisfies` makes TypeScript check that ar.json has every key that en.json has.
const BUNDLES = { ar: ar satisfies typeof en, en } as Record<Lang, Tree>;

/**
 * The text for `key` in `lang`, with `{{var}}` placeholders filled in. Values are inserted
 * raw: callers HTML-escape user content before passing it (see mail/escape.ts). A missing key
 * or placeholder value is a programming error and throws.
 */
export function t(lang: Lang, key: TranslationKey, vars: TranslationVars = {}): string {
  const text = key
    .split('.')
    .reduce<string | Tree | undefined>(
      (node, part) => (typeof node === 'object' ? node[part] : undefined),
      BUNDLES[lang],
    );
  if (typeof text !== 'string') throw new Error(`Missing translation: ${lang}.${key}`);
  return text.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
    const value = vars[name];
    if (value === undefined) throw new Error(`Missing value "${name}" for ${lang}.${key}`);
    return String(value);
  });
}
