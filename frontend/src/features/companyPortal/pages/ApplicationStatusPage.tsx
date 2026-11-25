import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CircleCheck, CircleX, Clock, FilePen, type LucideIcon } from 'lucide-react';
import type { ApplicationStatus } from '@mirhalgo/shared';
import { SimpleLayout } from '../../../components/layout/SimpleLayout';
import { Alert, Badge, Card, Spinner } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { usePageMeta } from '../../../lib/usePageMeta';
import { cn } from '../../../lib/utils';
import { LogoutButton } from '../../auth/components/LogoutButton';
import { useAuth } from '../../auth/hooks/useAuth';

type Application = {
  reference_number: string;
  status: ApplicationStatus;
  submitted_at: string;
  companies: { legal_name: string } | null;
};

/** Own application through RLS (only the granted columns). */
async function fetchApplication(companyId: string): Promise<Application> {
  const { data, error } = await supabase
    .from('company_applications')
    .select('reference_number, status, submitted_at, companies(legal_name)')
    .eq('company_id', companyId)
    .single();
  if (error) throw error;
  return data as unknown as Application;
}

const LOOK: Record<ApplicationStatus, { icon: LucideIcon; tone: string }> = {
  pending_verification: { icon: Clock, tone: 'bg-blue-50 text-blue-600' },
  pending_review: { icon: Clock, tone: 'bg-blue-50 text-blue-600' },
  approved: { icon: CircleCheck, tone: 'bg-blue-50 text-success' },
  rejected: { icon: CircleX, tone: 'bg-slate-50 text-error' },
  changes_requested: { icon: FilePen, tone: 'bg-violet-100 text-violet-600' },
};

/**
 * /company/application-status (moved from /application-status in MW_004): what a company
 * whose application is not approved sees after login
 * (MW_002 A6, MW_004 A1): pending review, changes requested or rejected.
 */
export default function ApplicationStatusPage() {
  const { t, i18n } = useTranslation();
  usePageMeta('applicationStatus');
  const { session } = useAuth();
  const companyId = session?.user.id ?? '';
  const application = useQuery({
    queryKey: ['company-application', companyId],
    queryFn: () => fetchApplication(companyId),
    enabled: Boolean(companyId),
  });

  const status = application.data?.status;
  const look = status ? LOOK[status] : null;

  return (
    <SimpleLayout actions={<LogoutButton />} back>
      <Card className="w-full max-w-xl p-8 text-center sm:p-10">
        {application.isPending && <Spinner className="mx-auto size-8 text-blue-600" />}
        {application.isError && <Alert tone="error">{t('companyStatus.error')}</Alert>}
        {application.data && look && status && (
          <div className="flex flex-col items-center gap-5">
            <span
              className={cn('flex size-16 items-center justify-center rounded-full', look.tone)}
            >
              <look.icon aria-hidden="true" className="size-8" />
            </span>
            <div>
              <p className="text-small text-muted">{application.data.companies?.legal_name}</p>
              <h1 className="mt-1 text-h2">{t('companyStatus.title')}</h1>
            </div>
            <Badge variant="accentSoft">{t(`companyStatus.status.${status}`)}</Badge>
            <p className="text-body">{t(`companyStatus.text.${status}`)}</p>
            <dl className="grid w-full gap-3 rounded-sm bg-slate-50 p-4 text-small sm:grid-cols-2">
              <div>
                <dt className="text-muted">{t('company.submitted.reference')}</dt>
                <dd dir="ltr" className="font-mono font-semibold text-heading">
                  {application.data.reference_number}
                </dd>
              </div>
              <div>
                <dt className="text-muted">{t('companyStatus.submittedAt')}</dt>
                <dd className="font-semibold text-heading">
                  {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(
                    new Date(application.data.submitted_at),
                  )}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </Card>
    </SimpleLayout>
  );
}
