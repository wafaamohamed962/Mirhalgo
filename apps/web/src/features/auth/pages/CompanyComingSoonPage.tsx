import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { buttonClasses } from '../../../components/ui';
import { usePageMeta } from '../../../lib/usePageMeta';
import { AuthCard } from '../components/AuthCard';

/** /signup/company (spec 4.1): placeholder until the company registration form exists. */
export default function CompanyComingSoonPage() {
  const { t } = useTranslation();
  usePageMeta('signupCompany');

  return (
    <AuthCard title={t('auth.companySoon.title')} needsBackend={false}>
      <div className="flex flex-col items-center gap-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-violet-100 text-violet-600">
          <Clock aria-hidden="true" className="size-8" />
        </span>
        <p className="text-body">{t('auth.companySoon.text')}</p>
        <Link to="/signup" className={buttonClasses({ variant: 'secondary' })}>
          {t('auth.companySoon.back')}
        </Link>
      </div>
    </AuthCard>
  );
}
