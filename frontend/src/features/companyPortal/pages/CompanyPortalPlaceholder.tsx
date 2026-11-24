import { useTranslation } from 'react-i18next';
import { SimpleLayout } from '../../../components/layout/SimpleLayout';
import { Card } from '../../../components/ui';
import { usePageMeta } from '../../../lib/usePageMeta';
import { LogoutButton } from '../../auth/components/LogoutButton';

/**
 * Temporary page for every /company/* section (MW_004 A2): proves the routing by role and
 * status. Replaced by the company portal layout and sections in Part B.
 */
export default function CompanyPortalPlaceholder() {
  const { t } = useTranslation();
  usePageMeta('companyPortal');
  return (
    <SimpleLayout actions={<LogoutButton />}>
      <Card className="w-full max-w-xl p-8 text-center sm:p-10">
        <h1 className="text-h2">{t('companyPortal.placeholder.title')}</h1>
        <p className="mt-3 text-body">{t('companyPortal.placeholder.text')}</p>
      </Card>
    </SimpleLayout>
  );
}
