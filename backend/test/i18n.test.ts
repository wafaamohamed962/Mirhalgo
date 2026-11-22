import { describe, expect, it } from 'vitest';
import ar from '../src/i18n/ar.json' with { type: 'json' };
import en from '../src/i18n/en.json' with { type: 'json' };
import { t } from '../src/i18n/index.js';

/* Backend copy (emails) lives in src/i18n/{ar,en}.json, like the web app (MW_003 A1). */

type Tree = { [key: string]: string | Tree };

/** key → text, for every string in the tree. */
const flatten = (tree: Tree, prefix = ''): Record<string, string> =>
  Object.fromEntries(
    Object.entries(tree).flatMap(([key, value]) =>
      typeof value === 'string'
        ? [[`${prefix}${key}`, value]]
        : Object.entries(flatten(value, `${prefix}${key}.`)),
    ),
  );

const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe('backend i18n', () => {
  const arTexts = flatten(ar);
  const enTexts = flatten(en);

  it('ar.json and en.json have exactly the same keys', () => {
    expect(Object.keys(arTexts).sort()).toEqual(Object.keys(enTexts).sort());
  });

  it('each key uses the same {{placeholders}} in both languages', () => {
    for (const key of Object.keys(enTexts)) {
      expect(placeholders(arTexts[key]!), key).toEqual(placeholders(enTexts[key]!));
    }
  });

  it('fills placeholders and fails loudly on a missing key or value', () => {
    expect(t('en', 'email.team.companySubject', { reference: 'MG-C-2026-000001' })).toBe(
      'New company application — MG-C-2026-000001',
    );
    expect(t('ar', 'email.otp.signup.body', { minutes: 10 })).toContain('10 دقائق');
    expect(() => t('en', 'email.team.companySubject')).toThrow('Missing value "reference"');
    // @ts-expect-error: unknown keys are a type error too
    expect(() => t('en', 'email.nope')).toThrow('Missing translation');
  });
});
