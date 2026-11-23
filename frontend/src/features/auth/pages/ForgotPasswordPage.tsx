import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { forgotPasswordSchema, resetPasswordSchema, type OtpSentResult } from '@mirhalgo/shared';
import { Alert, Button, Input, OtpInput, PasswordInput } from '../../../components/ui';
import { errorKey } from '../../../lib/apiClient';
import { useZodForm } from '../../../lib/forms';
import { usePageMeta } from '../../../lib/usePageMeta';
import { authApi } from '../api';
import { AuthCard } from '../components/AuthCard';
import { ResendCode } from '../components/ResendCode';
import type { LoginFlash } from './LoginPage';

/** /forgot-password (spec 4.6): email → neutral "code sent" → code + new password → /login. */
export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  usePageMeta('forgotPassword');
  const [sent, setSent] = useState<OtpSentResult | null>(null);

  return (
    <AuthCard
      back
      title={t(sent ? 'auth.forgot.resetTitle' : 'auth.forgot.title')}
      subtitle={sent ? undefined : t('auth.forgot.subtitle')}
      footer={
        <Link to="/login" className="font-semibold">
          {t('auth.forgot.back')}
        </Link>
      }
    >
      {sent ? (
        <ResetStep sent={sent} onChangeEmail={() => setSent(null)} />
      ) : (
        <EmailStep onSent={setSent} />
      )}
    </AuthCard>
  );
}

function EmailStep({ onSent }: { onSent: (result: OtpSentResult) => void }) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useZodForm(forgotPasswordSchema, { defaultValues: { email: '' } });
  const request = useMutation({ mutationFn: authApi.forgotPassword, onSuccess: onSent });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => request.mutate(values))}
      className="flex flex-col gap-5"
    >
      {request.isError && <Alert tone="error">{t(errorKey(request.error))}</Alert>}
      <Input
        label={t('auth.forgot.email')}
        type="email"
        autoComplete="email"
        dir="ltr"
        required
        error={errors.email?.message}
        {...register('email')}
      />
      <Button type="submit" shape="form" fullWidth loading={request.isPending}>
        {t('auth.forgot.submit')}
      </Button>
    </form>
  );
}

function ResetStep({ sent, onChangeEmail }: { sent: OtpSentResult; onChangeEmail: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useZodForm(resetPasswordSchema, {
    defaultValues: { email: sent.email, code: '', password: '', confirmPassword: '' },
  });

  const reset = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      const flash: LoginFlash = 'resetSuccess';
      navigate('/login', { replace: true, state: { flash } });
    },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => reset.mutate(values))}
      className="flex flex-col gap-5"
    >
      {/* neutral on purpose: no user enumeration (spec 4.6) */}
      <Alert>{t('auth.forgot.sent', { email: sent.email })}</Alert>
      {reset.isError && <Alert tone="error">{t(errorKey(reset.error))}</Alert>}

      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <OtpInput
            label={t('auth.forgot.code')}
            value={field.value}
            onChange={field.onChange}
            error={errors.code?.message}
            focusOnMount
          />
        )}
      />
      <PasswordInput
        label={t('auth.forgot.password')}
        autoComplete="new-password"
        showStrength
        required
        error={errors.password?.message}
        {...register('password')}
      />
      <PasswordInput
        label={t('auth.forgot.confirmPassword')}
        autoComplete="new-password"
        required
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      <Button type="submit" shape="form" fullWidth loading={reset.isPending}>
        {t('auth.forgot.resetSubmit')}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ResendCode
          initialCooldown={sent.cooldownSeconds}
          send={() => authApi.forgotPassword({ email: sent.email })}
        />
        <Button variant="ghost" shape="form" onClick={onChangeEmail}>
          {t('auth.forgot.changeEmail')}
        </Button>
      </div>
    </form>
  );
}
