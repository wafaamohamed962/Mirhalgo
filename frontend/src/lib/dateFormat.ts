import { useCallback, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

/*
 * Date format preference (MW_002 decision 21): DD/MM/YYYY (default) or YYYY-MM-DD, saved in
 * localStorage. Digits follow the language (Arabic-Indic in Arabic).
 */

export const DATE_FORMATS = ['dmy', 'ymd'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

const STORAGE_KEY = 'mirhalgo.dateFormat';
const EVENT = 'mirhalgo:dateformat';

function read(): DateFormat {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ymd' ? 'ymd' : 'dmy';
  } catch {
    return 'dmy';
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function setDateFormat(format: DateFormat) {
  try {
    localStorage.setItem(STORAGE_KEY, format);
  } catch {
    // not persisted; still applied for this page
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Formats an ISO date with the user's format and language. */
export function formatDate(iso: string, language: string, format: DateFormat, withTime = false) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat(language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const text =
    format === 'ymd'
      ? `${part('year')}-${part('month')}-${part('day')}`
      : `${part('day')}/${part('month')}/${part('year')}`;
  if (!withTime) return text;
  const time = new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(
    date,
  );
  return `${text} · ${time}`;
}

/** Current format + a formatter bound to the current language. */
export function useDateFormat() {
  const { i18n } = useTranslation();
  const format = useSyncExternalStore(subscribe, read, () => 'dmy' as const);
  const formatDateBound = useCallback(
    (iso: string, withTime = false) => formatDate(iso, i18n.language, format, withTime),
    [i18n.language, format],
  );
  return { format, formatDate: formatDateBound };
}
