import i18n from '../index';
import ar from './ar.json';
import en from './en.json';

/*
 * Customer-portal copy (`portal.*`) lives in its own chunk: it is imported by the portal
 * layout only, so landing/auth visitors never download it (Lighthouse, MW_002 B).
 */
i18n.addResourceBundle('ar', 'translation', ar, true, false);
i18n.addResourceBundle('en', 'translation', en, true, false);
