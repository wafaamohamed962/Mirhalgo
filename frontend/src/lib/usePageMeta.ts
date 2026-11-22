import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const OG_LOCALES: Record<string, string> = { ar: 'ar_EG', en: 'en_US' };

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

/**
 * Per-page title, description and Open Graph tags in the current language (spec 8.5).
 * `page` is a key under `meta.*` in the i18n files.
 */
export function usePageMeta(page: string) {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const title = t(`meta.${page}.title`);
    const description = t(`meta.${page}.description`);
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:locale', OG_LOCALES[i18n.language] ?? OG_LOCALES.ar);
  }, [page, t, i18n.language]);
}
