import { useEffect } from 'react';
import { useMatches } from 'react-router';
import { useTranslation } from 'react-i18next';

/** Route `handle` of every portal page: its title (`<navPrefix>.<title>` or a full key). */
export type PortalHandle = { title: string };

/** The deepest route title, also set as the document title ("<title> | <brand>"). */
export function usePortalTitle(navPrefix: string, brandKey: string) {
  const { t } = useTranslation();
  const handle = [...useMatches()].reverse().find((m) => (m.handle as PortalHandle)?.title)
    ?.handle as PortalHandle | undefined;
  const title = handle
    ? t(handle.title.includes('.') ? handle.title : `${navPrefix}.${handle.title}`)
    : '';
  useEffect(() => {
    document.title = `${title} | ${t(brandKey)}`;
  }, [title, t, brandKey]);
  return title;
}
