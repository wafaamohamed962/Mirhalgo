import { useMemo } from 'react';
import { FormProvider } from 'react-hook-form';
import { Link, Navigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Send } from 'lucide-react';
import { SERVICE_TYPES, type ServiceType } from '@mirhalgo/shared';
import { DraftRestoredNotice } from '../../components/DraftRestoredNotice';
import {
  Alert,
  Button,
  Card,
  ProgressBar,
  Skeleton,
  Stepper,
  type Step,
} from '../../components/ui';
import { useMe, useMeSummary } from '../../services/api/queries';
import { RequestFormContext } from './formContext';
import { CargoStep } from './steps/CargoStep';
import { ChinaDeliveryStep, ChinaOrderStep } from './steps/ChinaSteps';
import { CustomerStep } from './steps/CustomerStep';
import { DomesticOperationStep, OperationStep } from './steps/OperationStep';
import { ReviewStep } from './steps/ReviewStep';
import { DomesticRouteStep, RouteStep } from './steps/RouteStep';
import { ServicesStep } from './steps/ServicesStep';
import type { Prefill } from './model';
import { useRequestWizard } from './useRequestWizard';

function StepBody({
  service,
  wizard,
}: {
  service: ServiceType;
  wizard: ReturnType<typeof useRequestWizard>;
}) {
  switch (wizard.step) {
    case 'customer':
      return <CustomerStep service={service} />;
    case 'operation':
      return service === 'domestic' ? <DomesticOperationStep /> : <OperationStep />;
    case 'route':
      return service === 'domestic' ? <DomesticRouteStep /> : <RouteStep />;
    case 'cargo':
      return <CargoStep service={service} />;
    case 'services':
      return <ServicesStep domestic={service === 'domestic'} />;
    case 'order':
      return <ChinaOrderStep />;
    case 'delivery':
      return <ChinaDeliveryStep />;
    default:
      return <ReviewStep service={service} wizard={wizard} />;
  }
}

/** One service form (spec B2–B5): steps, draft, validation and submit. */
function RequestForm({ service, prefill }: { service: ServiceType; prefill: Prefill }) {
  const { t, i18n } = useTranslation();
  const wizard = useRequestWizard(service, prefill);
  const balance = useMeSummary().data?.balance.remaining;
  const blocked = balance === 0;
  const total = wizard.steps.length;
  const steps: Step[] = wizard.steps.map((id) => ({
    id,
    label: t(`portal.request.steps.${id}`),
    completed: wizard.completed.has(id),
  }));
  const context = useMemo(
    () => ({ service, uploads: wizard.uploads, rememberUploads: wizard.rememberUploads }),
    [service, wizard.uploads, wizard.rememberUploads],
  );

  if (!wizard.ready) return <Skeleton className="h-96 rounded-lg" />;
  const isReview = wizard.step === 'review';

  return (
    <Card className="flex flex-col gap-6 p-5 sm:p-8">
      {wizard.restored && (
        <DraftRestoredNotice onStartOver={wizard.startOver} onDismiss={wizard.dismissRestored} />
      )}
      <Stepper
        steps={steps}
        current={wizard.index}
        onSelect={(i) => wizard.select(wizard.steps[i]!)}
        label={t('portal.request.stepsLabel')}
      />
      <div className="flex flex-col gap-2">
        <p className="text-small font-semibold text-heading">
          {t('portal.request.stepOf', {
            current: (wizard.index + 1).toLocaleString(i18n.language),
            total: total.toLocaleString(i18n.language),
            name: t(`portal.request.steps.${wizard.step}`),
          })}
        </p>
        <ProgressBar
          value={((wizard.index + 1) / total) * 100}
          label={t('portal.request.progress')}
        />
      </div>

      <RequestFormContext.Provider value={context}>
        <FormProvider {...wizard.form}>
          <form
            key={wizard.formKey}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (isReview) void wizard.submit();
              else wizard.next();
            }}
            className="flex flex-col gap-8"
          >
            <StepBody service={service} wizard={wizard} />

            {wizard.submitError && <Alert tone="error">{t(wizard.submitError)}</Alert>}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-between">
              {wizard.index > 0 ? (
                <Button
                  variant="secondary"
                  shape="form"
                  onClick={wizard.back}
                  disabled={wizard.submitting}
                >
                  <ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
                  {t('portal.request.back')}
                </Button>
              ) : (
                <span />
              )}
              <Button
                type="submit"
                shape="form"
                loading={wizard.submitting}
                disabled={isReview && blocked}
              >
                {isReview ? t('portal.request.submit') : t('portal.request.next')}
                {isReview ? (
                  <Send aria-hidden="true" className="size-4 rtl:-scale-x-100" />
                ) : (
                  <ArrowRight aria-hidden="true" className="size-4 rtl:rotate-180" />
                )}
              </Button>
            </div>
          </form>
        </FormProvider>
      </RequestFormContext.Provider>
      {wizard.leaveDialog}
    </Card>
  );
}

/** /app/new-request/:service (MW_003 B3–B5). */
export default function RequestFormPage() {
  const { t } = useTranslation();
  const { service } = useParams();
  const me = useMe();
  const prefill = useMemo<Prefill | null>(
    () =>
      me.data
        ? { fullName: `${me.data.firstName} ${me.data.lastName}`.trim(), phone: me.data.phone }
        : null,
    [me.data],
  );
  if (!SERVICE_TYPES.includes(service as ServiceType))
    return <Navigate to="/app/new-request" replace />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h2">{t(`portal.services.${service}.title`)}</h2>
        <Link
          to="/app/new-request"
          className="inline-flex min-h-11 items-center gap-1.5 text-small font-semibold"
        >
          <ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
          {t('portal.request.backToServices')}
        </Link>
      </div>
      {prefill ? (
        // a new form per service (and per user): never mixes the state of two forms
        <RequestForm key={service} service={service as ServiceType} prefill={prefill} />
      ) : me.isError ? (
        <Alert tone="error">{t('portal.request.loadError')}</Alert>
      ) : (
        <Skeleton className="h-96 rounded-lg" />
      )}
    </div>
  );
}
