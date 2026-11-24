import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../../components/ui';
import { usePortalTitle } from '../../../components/portal/usePortalTitle';
import { CompanyPageHeader } from '../components/common';

/**
 * A company section whose page comes in a later phase (MW_004 B4–B10): the header (title,
 * Back on every section but Overview) and a short notice. Replaced section by section.
 */
export default function SectionPage() {
  const { t } = useTranslation();
  const title = usePortalTitle('companyPortal.nav', 'companyPortal.brand');
  const isOverview = useLocation().pathname === '/company/overview';
  return (
    <>
      <CompanyPageHeader title={title} back={!isOverview} />
      <EmptyState title={t('companyPortal.sectionSoon')} />
    </>
  );
}
