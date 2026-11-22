import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { SimpleLayout } from '../../../components/layout/SimpleLayout';
import { Alert, Button, Card, ProgressBar, Stepper, type Step } from '../../../components/ui';
import { ServiceNotice } from '../../../components/ui/ServiceNotice';
import { ApiRequestError, errorKey } from '../../../lib/apiClient';
import { usePageMeta } from '../../../lib/usePageMeta';
import { useUnsavedChangesGuard } from '../../../lib/useUnsavedChangesGuard';
import { setPendingVerification } from '../../auth/pendingVerification';
import { registerCompany } from '../api';
import { AccountStep } from '../components/AccountStep';
import { DocumentsStep } from '../components/DocumentsStep';
import { DraftRestoredNotice } from '../components/DraftRestoredNotice';
import { ReviewStep } from '../components/ReviewStep';
import { ServicesStep } from '../components/ServicesStep';
import { clearCompanyDraft, loadCompanyDraft, saveCompanyDraft, withDraft } from '../draft';
import {
  EMPTY_VALUES,
  STEP_IDS,
  STEP_SCHEMAS,
  isStepSkipped,
  stepOfField,
  type CompanyFormValues,
  type StepId,
} from '../model';

const AUTOSAVE_DELAY_MS = 500;
const FILE_ERRORS = ['FILE_REQUIRED', 'FILE_TYPE_NOT_ALLOWED', 'FILE_TOO_LARGE', 'TOO_MANY_FILES'];

/**
 * /signup/company (MW_002 A1–A2): 4-step wizard → POST /api/companies/register →
 * /verify-email. "Next" validates the current step only; Back never loses data.
 */
export default function CompanyRegistrationPage() {
  const { t } = useTranslation();
  usePageMeta('signupCompany');
  const navigate = useNavigate();

  const [step, setStep] = useState<StepId>('account');
  const [completed, setCompleted] = useState<ReadonlySet<StepId>>(new Set());
  const [initialDraft] = useState(loadCompanyDraft); // read once, on arrival
  const [showRestored, setShowRestored] = useState(initialDraft !== null);
  const [formKey, setFormKey] = useState(0); // remounts inputs after a reset
  const [progress, setProgress] = useState(0);

  // The resolver follows the current step (read through a ref: the form is created once).
  const stepRef = useRef(step);
  stepRef.current = step;
  const resolver: Resolver<CompanyFormValues> = (values, context, options) =>
    zodResolver(STEP_SCHEMAS[stepRef.current])(values, context, options as never) as never;

  const form = useForm<CompanyFormValues>({
    mode: 'onTouched',
    defaultValues: EMPTY_VALUES,
    resolver,
  });
  const { isDirty } = form.formState;
  const activities = form.watch('activities');

  const visibleSteps = useMemo(
    () => STEP_IDS.filter((id) => !isStepSkipped(id, activities)),
    [activities],
  );
  const index = visibleSteps.indexOf(step);

  // ── draft (decision 24): restored automatically on arrival, before the first paint. Same
  // reset as the old "Continue" button, so the form is dirty (leave guard) exactly as before.
  useLayoutEffect(() => {
    if (!initialDraft) return;
    form.reset(withDraft(EMPTY_VALUES, initialDraft.values), { keepDefaultValues: true });
    setFormKey((key) => key + 1);
  }, [form, initialDraft]);

  // ── autosave (text only, see draft.ts) after each edit. Resets (restore, start over) have
  // no field name and are not edits, so they never write a draft.
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelAutosave = () => {
    if (pendingSave.current) clearTimeout(pendingSave.current);
    pendingSave.current = null;
  };
  useEffect(() => {
    const subscription = form.watch((_values, { name }) => {
      if (!name) return;
      if (pendingSave.current) clearTimeout(pendingSave.current);
      pendingSave.current = setTimeout(() => {
        pendingSave.current = null;
        saveCompanyDraft(form.getValues());
      }, AUTOSAVE_DELAY_MS);
    });
    return () => {
      subscription.unsubscribe();
      // Leaving with a save still pending ("Back to home" right after typing): save it now,
      // so "Your draft is saved" is true (MW_003 A3).
      if (pendingSave.current) {
        clearTimeout(pendingSave.current);
        pendingSave.current = null;
        saveCompanyDraft(form.getValues());
      }
    };
  }, [form]);

  /** "Start over": drop the draft and give the user an empty form on the first step. */
  const startOver = () => {
    cancelAutosave(); // a pending save must not bring the draft back
    clearCompanyDraft();
    form.reset(EMPTY_VALUES);
    setFormKey((key) => key + 1);
    setCompleted(new Set());
    setStep('account');
    setShowRestored(false);
    requestAnimationFrame(() => form.setFocus('legalName'));
  };

  // leaving with unsaved changes (MW_002 A1; "Back to home" in the header, MW_003 A3)
  const leaveGuard = useUnsavedChangesGuard(isDirty, {
    title: t('company.register.leave.title'),
    description: t('company.register.leave.text'),
  });

  const goTo = (next: StepId) => {
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  const register = useMutation({
    mutationFn: (values: CompanyFormValues) => registerCompany(values, setProgress),
    onMutate: () => setProgress(0),
    onSuccess: (result) => {
      leaveGuard.allowLeave();
      cancelAutosave();
      clearCompanyDraft();
      setPendingVerification(result.email, null, 'company'); // no auto-login (decision 6)
      navigate('/verify-email', { state: { cooldown: result.cooldownSeconds } });
    },
    onError: (error) => {
      if (error instanceof ApiRequestError && FILE_ERRORS.includes(error.code)) goTo('documents');
    },
  });

  /** Next / Submit: validates this step (all steps on the last one). */
  const onContinue = form.handleSubmit(
    () => {
      setCompleted((done) => new Set(done).add(step));
      if (step === 'review') return register.mutate(form.getValues());
      goTo(visibleSteps[index + 1] ?? 'review');
    },
    (errors) => {
      // on submit an error may belong to an earlier step: show it there
      const first = Object.keys(errors)[0];
      if (step === 'review' && first && stepOfField(first) !== 'review') goTo(stepOfField(first));
    },
  );

  /** Stepper click on a completed step; going forward needs the current step to be valid. */
  const onSelectStep = async (target: StepId) => {
    if (STEP_IDS.indexOf(target) > STEP_IDS.indexOf(step) && !(await form.trigger())) return;
    goTo(target);
  };

  const steps: Step[] = STEP_IDS.map((id) => ({
    id,
    label: t(`company.register.steps.${id}`),
    completed: completed.has(id),
    skipped: isStepSkipped(id, activities),
  }));

  return (
    <SimpleLayout backHome>
      <Card className="w-full max-w-3xl p-6 sm:p-10">
        <header className="mb-8 text-center">
          <h1 className="text-h2">{t('company.register.title')}</h1>
          <p className="mt-2 text-body">{t('company.register.subtitle')}</p>
        </header>

        <div className="flex flex-col gap-6">
          <ServiceNotice needs="auth" />

          {showRestored && (
            <DraftRestoredNotice onStartOver={startOver} onDismiss={() => setShowRestored(false)} />
          )}

          <Stepper
            steps={steps}
            current={STEP_IDS.indexOf(step)}
            onSelect={(i) => onSelectStep(STEP_IDS[i]!)}
            label={t('company.register.stepsLabel')}
          />
          <p aria-live="polite" className="sr-only">
            {t('company.register.stepOf', { current: index + 1, total: visibleSteps.length })}
          </p>

          {register.isError && <Alert tone="error">{t(errorKey(register.error))}</Alert>}

          <FormProvider {...form}>
            <form key={formKey} noValidate onSubmit={onContinue} className="flex flex-col gap-8">
              {step === 'account' && <AccountStep />}
              {step === 'services' && <ServicesStep />}
              {step === 'documents' && <DocumentsStep />}
              {step === 'review' && <ReviewStep goTo={goTo} />}

              {register.isPending && (
                <div className="flex flex-col gap-2">
                  <ProgressBar value={progress} label={t('company.register.uploadProgress')} />
                  <p className="text-caption text-muted">
                    {t('company.register.uploading', { percent: Math.round(progress) })}
                  </p>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-between">
                {index > 0 ? (
                  <Button
                    variant="secondary"
                    shape="form"
                    disabled={register.isPending}
                    onClick={() => goTo(visibleSteps[index - 1]!)}
                  >
                    <ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
                    {t('company.register.back')}
                  </Button>
                ) : (
                  <span />
                )}
                <Button type="submit" shape="form" loading={register.isPending}>
                  {step === 'review' ? t('company.register.submit') : t('company.register.next')}
                  {step !== 'review' && (
                    <ArrowRight aria-hidden="true" className="size-4 rtl:rotate-180" />
                  )}
                </Button>
              </div>
            </form>
          </FormProvider>

          <p className="text-center text-small text-body">
            {t('company.register.haveAccount')}{' '}
            <Link to="/login" className="font-semibold">
              {t('company.register.login')}
            </Link>
          </p>
        </div>
      </Card>

      {leaveGuard.dialog}
    </SimpleLayout>
  );
}
