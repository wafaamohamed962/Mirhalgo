import { useTranslation } from 'react-i18next';
import { missingApiEnv, missingSupabaseEnv } from '../../lib/env';
import { Alert } from './Alert';

/**
 * Translated notice for features that cannot work because configuration is missing.
 * `api` = contact form; `auth` = auth pages (API + Supabase session).
 */
export function ServiceNotice({ needs }: { needs: 'api' | 'auth' }) {
  const { t } = useTranslation();
  const missing = needs === 'api' ? missingApiEnv : [...missingApiEnv, ...missingSupabaseEnv];
  if (missing.length === 0) return null;
  return <Alert tone="error">{t('errors.CONFIG_MISSING')}</Alert>;
}
