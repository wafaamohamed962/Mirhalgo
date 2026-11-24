import i18n from '../index';
import ar from './ar.json';
import en from './en.json';

/*
 * Company portal copy (`companyPortal.*`, MW_004) in its own chunk, like the customer
 * portal's: imported by the company layout only.
 */
i18n.addResourceBundle('ar', 'translation', ar, true, false);
i18n.addResourceBundle('en', 'translation', en, true, false);
