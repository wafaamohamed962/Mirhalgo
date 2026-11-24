import { useState, type ReactNode } from 'react';
import { Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  changePasswordSchema,
  companyContactSchema,
  type ChangePasswordInput,
  type CompanyAccount,
  type CompanyContactInput,
} from '@mirhalgo/shared';
import {
  Alert,
  Button,
  ConfirmDialog,
  Input,
  PasswordInput,
  PhoneInput,
  QueryState,
  Switch,
  cardClasses,
} from '../../../components/ui';
import { errorKey } from '../../../lib/apiClient';
import { flags } from '../../../lib/env';
import { hasChanges, useZodForm } from '../../../lib/forms';
import { useUnsavedChangesGuard } from '../../../lib/useUnsavedChangesGuard';
import { companyApi } from '../../../services/api/company';
import { companyKeys, useCompanyAccount } from '../../../services/api/companyQueries';
import { useAuth } from '../../auth/hooks/useAuth';
import { StatusPill } from '../../portal/components/StatusBadge';
import { CompanyPageHeader } from '../components/common';
import { clearSeen } from '../seen';

/*
 * Account settings (MW_004 spec B9): company data (contact email / phone editable, validated),
 * offer privacy, the offer submission status (set by the administration), the password
 * (current + new + confirm, the sign-up policy; mocked in this task) and, in dev / staging
 * only, the demo tools.
 */

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className={cardClasses({ className: 'flex flex-col gap-4 p-5' })}>
      <h2 className="text-h3">{title}</h2>
      {children}
    </section>
  );
}

/** Invalidates the whole company portal (badges, KPIs, the activity log follow). */
function useRefreshPortal() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: companyKeys.all });
}

function CompanyData({ account }: { account: CompanyAccount }) {
  const { t } = useTranslation();
  const refresh = useRefreshPortal();
  const defaults = { contactEmail: account.contactEmail, contactPhone: account.contactPhone };
  const form = useZodForm(companyContactSchema, { defaultValues: defaults });
  const { errors, dirtyFields } = form.formState;
  const guard = useUnsavedChangesGuard(hasChanges(dirtyFields));
  const save = useMutation({
    mutationFn: (input: CompanyContactInput) => companyApi.updateContact(input),
    onSuccess: async (saved) => {
      form.reset({ contactEmail: saved.contactEmail, contactPhone: saved.contactPhone });
      toast.success(t('companyPortal.settings.contactSaved'));
      await refresh();
    },
    onError: (error) => toast.error(t(errorKey(error))),
  });
  const activity = [
    ...account.activities.map((a) => t(`companyPortal.settings.activities.${a}`)),
  ].join('، ');
  const scope = account.internationalScope
    ? ` (${t(`companyPortal.settings.scopes.${account.internationalScope}`)})`
    : '';

  return (
    <Block title={t('companyPortal.settings.company')}>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-caption text-muted">{t('companyPortal.settings.legalName')}</dt>
          <dd className="text-base font-semibold text-heading">{account.legalName}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted">{t('companyPortal.settings.activity')}</dt>
          <dd className="text-base font-semibold text-heading">
            {activity}
            {scope}
          </dd>
        </div>
      </dl>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
        className="grid gap-4 sm:grid-cols-2"
      >
        <Input
          label={t('companyPortal.settings.contactEmail')}
          type="email"
          dir="ltr"
          autoComplete="email"
          required
          error={errors.contactEmail?.message}
          {...form.register('contactEmail')}
        />
        <Controller
          control={form.control}
          name="contactPhone"
          render={({ field }) => (
            <PhoneInput
              label={t('companyPortal.settings.contactPhone')}
              required
              error={errors.contactPhone?.message}
              {...field}
            />
          )}
        />
        <p className="text-caption text-muted sm:col-span-2">
          {t('companyPortal.settings.contactNote')}
        </p>
        <Button type="submit" shape="form" className="justify-self-start" loading={save.isPending}>
          {t('companyPortal.settings.save')}
        </Button>
      </form>
      {guard.dialog}
    </Block>
  );
}

function OfferPrivacy({ account }: { account: CompanyAccount }) {
  const { t } = useTranslation();
  const refresh = useRefreshPortal();
  const update = useMutation({
    mutationFn: (hideOffers: boolean) => companyApi.updatePrivacy({ hideOffers }),
    onSuccess: async (saved) => {
      toast.success(
        t(
          saved.hideOffers
            ? 'companyPortal.settings.privacyOn'
            : 'companyPortal.settings.privacyOff',
        ),
      );
      await refresh(); // the activity log records the change
    },
    onError: (error) => toast.error(t(errorKey(error))),
  });
  return (
    <Block title={t('companyPortal.settings.privacy')}>
      <Switch
        label={t('companyPortal.settings.hideOffers')}
        checked={update.isPending ? update.variables : account.hideOffers}
        disabled={update.isPending}
        onChange={(event) => update.mutate(event.target.checked)}
      />
      <p className="text-small text-muted">{t('companyPortal.settings.privacyNote')}</p>
    </Block>
  );
}

function SubmissionStatus({ account }: { account: CompanyAccount }) {
  const { t } = useTranslation();
  const allowed = account.offerSubmission === 'allowed';
  return (
    <Block title={t('companyPortal.settings.submission')}>
      <StatusPill
        tone={allowed ? 'success' : 'error'}
        label={t(`companyPortal.settings.submissionStatus.${account.offerSubmission}`)}
      />
      <p className="text-small text-muted">{t('companyPortal.settings.submissionNote')}</p>
    </Block>
  );
}

const EMPTY_PASSWORD: ChangePasswordInput = {
  currentPassword: '',
  password: '',
  confirmPassword: '',
};

function Password() {
  const { t } = useTranslation();
  const refresh = useRefreshPortal();
  const form = useZodForm(changePasswordSchema, { defaultValues: EMPTY_PASSWORD });
  const { errors } = form.formState;
  const change = useMutation({
    mutationFn: (input: ChangePasswordInput) => companyApi.changePassword(input),
    onSuccess: async () => {
      form.reset(EMPTY_PASSWORD);
      toast.success(t('companyPortal.settings.passwordChanged'));
      await refresh();
    },
    onError: (error) => toast.error(t(errorKey(error))),
  });
  return (
    <Block title={t('companyPortal.settings.password')}>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => change.mutate(values))}
        className="grid gap-4 sm:grid-cols-2"
      >
        <div className="sm:col-span-2 sm:max-w-sm">
          <PasswordInput
            label={t('companyPortal.settings.currentPassword')}
            autoComplete="current-password"
            required
            error={errors.currentPassword?.message}
            {...form.register('currentPassword')}
          />
        </div>
        <PasswordInput
          label={t('companyPortal.settings.newPassword')}
          autoComplete="new-password"
          showStrength
          required
          error={errors.password?.message}
          {...form.register('password')}
        />
        <PasswordInput
          label={t('companyPortal.settings.confirmPassword')}
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...form.register('confirmPassword')}
        />
        <Button
          type="submit"
          shape="form"
          className="justify-self-start"
          loading={change.isPending}
        >
          {t('companyPortal.settings.changePassword')}
        </Button>
      </form>
    </Block>
  );
}

/** Dev / staging only (spec B1, B9): reset the demo data; simulate a suspension (plan Q11). */
function DemoTools({ account }: { account: CompanyAccount }) {
  const { t } = useTranslation();
  const accountId = useAuth().session?.user.id ?? '';
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const reset = useMutation({
    mutationFn: companyApi.demo.reset,
    onSuccess: async () => {
      clearSeen(accountId); // "New" badges start again too
      await queryClient.resetQueries({ queryKey: companyKeys.all });
      toast.success(t('companyPortal.settings.demo.resetDone'));
    },
    onError: (error) => toast.error(t(errorKey(error))),
  });
  const suspend = useMutation({
    mutationFn: (suspended: boolean) =>
      companyApi.demo.setOfferSubmission(suspended ? 'suspended' : 'allowed'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: companyKeys.all }),
    onError: (error) => toast.error(t(errorKey(error))),
  });
  return (
    <Block title={t('companyPortal.settings.demo.title')}>
      <Alert tone="info">{t('companyPortal.settings.demo.note')}</Alert>
      <div className="flex flex-col gap-2">
        <Switch
          label={t('companyPortal.settings.demo.suspend')}
          checked={suspend.isPending ? suspend.variables : account.offerSubmission === 'suspended'}
          disabled={suspend.isPending}
          onChange={(event) => suspend.mutate(event.target.checked)}
        />
        <p className="text-small text-muted">{t('companyPortal.settings.demo.suspendNote')}</p>
      </div>
      <Button
        variant="danger"
        shape="form"
        className="self-start justify-self-start"
        loading={reset.isPending}
        onClick={() => setConfirm(true)}
      >
        {t('companyPortal.settings.demo.reset')}
      </Button>
      {confirm && (
        <ConfirmDialog
          title={t('companyPortal.settings.demo.resetTitle')}
          description={t('companyPortal.settings.demo.resetText')}
          confirmLabel={t('companyPortal.settings.demo.reset')}
          cancelLabel={t('ui.cancel')}
          tone="danger"
          onConfirm={() => {
            setConfirm(false);
            reset.mutate();
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </Block>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const account = useCompanyAccount();
  return (
    <>
      <CompanyPageHeader title={t('companyPortal.nav.settings')} />
      <QueryState query={account}>
        {(data) => (
          <div className="flex flex-col gap-6">
            <CompanyData account={data} />
            <OfferPrivacy account={data} />
            <SubmissionStatus account={data} />
            <Password />
            {flags.demoTools && <DemoTools account={data} />}
          </div>
        )}
      </QueryState>
    </>
  );
}
