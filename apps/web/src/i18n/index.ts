import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './ar.json';
import en from './en.json';

/**
 * i18n (spec 8.1): Arabic by default, choice saved in localStorage,
 * keeps <html lang dir> in sync. Numbers/dates use i18next's Intl formatters
 * in the JSON files, e.g. `{{seconds, number}}`.
 */
export const LANGUAGES = ['ar', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

const DEFAULT_LANGUAGE: Language = 'ar';
const STORAGE_KEY = 'mirhalgo.lang';

const isLanguage = (value: unknown): value is Language => LANGUAGES.includes(value as Language);

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE; // storage blocked (privacy mode)
  }
}

function applyLanguage(language: string) {
  document.documentElement.lang = language;
  document.documentElement.dir = i18n.dir(language);
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // ignore: the choice just won't persist
  }
}

i18n.on('languageChanged', applyLanguage);

void i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: readStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES,
  interpolation: { escapeValue: false }, // React already escapes
  react: { transKeepBasicHtmlNodesFor: ['strong'] },
});

export default i18n;
