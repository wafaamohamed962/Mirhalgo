import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CircleCheck } from 'lucide-react';
import { Badge, buttonClasses } from '../../../components/ui';
import { usePageMeta } from '../../../lib/usePageMeta';
import { AuthCard } from '../../auth/components/AuthCard';

export type SubmittedState = { referenceNumber?: string } | null;

/**
 * Shown after the company's email is verified (MW_002 A2): reference number + 48-hour
 * review notice. No login (decision 6). After a reload the reference is only in the email.
 */
export default function ApplicationSubmittedPage() {
  const { t } = useTranslation();
  usePageMeta('applicationSubmitted');
  const referenceNumber = (useLocation().state as SubmittedState)?.referenceNumber;

  return (
    <AuthCard title={t('company.submitted.title')} needsBackend={false}>
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-blue-50 text-success">
          <CircleCheck aria-hidden="true" className="size-9" />
        </span>

        {referenceNumber && (
          <div className="w-full rounded-sm border-2 border-blue-600 bg-blue-50 p-4">
            <p className="text-caption text-muted">{t('company.submitted.reference')}</p>
            <p dir="ltr" className="font-mono text-h3 text-blue-600">
              {referenceNumber}
            </p>
          </div>
        )}

        <p className="flex items-center gap-2 text-small text-body">
          {t('company.submitted.status')}
          <Badge variant="accentSoft">{t('company.submitted.pendingReview')}</Badge>
        </p>
        <p className="text-body">{t('company.submitted.text')}</p>
        <p className="text-small text-muted">
          {t(referenceNumber ? 'company.submitted.email' : 'company.submitted.noReference')}
        </p>

        <Link to="/" className={buttonClasses({ variant: 'secondary' })}>
          {t('company.submitted.home')}
        </Link>
      </div>
    </AuthCard>
  );
}
