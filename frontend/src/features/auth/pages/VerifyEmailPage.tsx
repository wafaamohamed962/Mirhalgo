import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { OTP_LENGTH, OTP_RESEND_COOLDOWN_SECONDS, OTP_TTL_MINUTES } from '@mirhalgo/shared';
import { Alert, Button, OtpInput } from '../../../components/ui';
import { ApiRequestError, errorKey } from '../../../lib/apiClient';
import { usePageMeta } from '../../../lib/usePageMeta';
import { authApi } from '../api';
import { AuthCard } from '../components/AuthCard';
import { ResendCode } from '../components/ResendCode';
import { useLogin } from '../hooks/useLogin';
import { clearPendingVerification, getPendingVerification } from '../pendingVerification';
import { homePath } from '../roles';
import type { SubmittedState } from '../../companyRegistration/pages/ApplicationSubmittedPage';
import type { LoginFlash } from './LoginPage';

type VerifyState = { cooldown?: number; notice?: 'unverified' } | null;

/**
 * /verify-email (spec 4.3): 6-digit code → POST /api/auth/verify-email → automatic
 * login with the password kept in memory → the customer portal. The guard guarantees a pending email.
 */
export default function VerifyEmailPage() {
  const { t } = useTranslation();
  usePageMeta('verifyEmail');
  const navigate = useNavigate();
  const state = useLocation().state as VerifyState;
  const [pending] = useState(getPendingVerification);
  const [code, setCode] = useState('');
  const login = useLogin();
  const email = pending?.email ?? '';

  const finish = async () => {
    const password = pending?.password;
    clearPendingVerification();
    if (password) {
      const result = await login.mutateAsync({ identifier: email, password }).catch(() => null);
      if (result?.status === 'authenticated') {
        toast.success(t('auth.verify.success'));
        return navigate(homePath(result.role), { replace: true });
      }
    }
    // password lost (page reload) or login failed: log in manually
    const flash: LoginFlash = 'verifiedLogin';
    navigate('/login', { replace: true, state: { flash } });
  };

  const verify = useMutation({
    mutationFn: (value: string) => authApi.verifyEmail({ email, code: value }),
    onSuccess: (result) => {
      if (result.role !== 'company') return finish();
      // companies are not logged in (MW_002 decision 6): show the application screen
      clearPendingVerification();
      const state: SubmittedState = { referenceNumber: result.application.referenceNumber };
      navigate('/signup/company/submitted', { replace: true, state });
    },
    onError: (error) => {
      // wrong code: clear the boxes so the user can type again
      if (error instanceof ApiRequestError && error.code === 'OTP_INVALID') setCode('');
    },
  });
  const busy = verify.isPending || login.isPending;

  return (
    <AuthCard
      title={t('auth.verify.title')}
      subtitle={
        <Trans
          i18nKey="auth.verify.subtitle"
          values={{ email, minutes: OTP_TTL_MINUTES }}
          components={{ strong: <strong dir="ltr" className="text-heading" /> }}
        />
      }
      footer={
        pending?.kind === 'company' ? (
          <Link to="/signup/company" className="font-semibold">
            {t('auth.verify.changeEmailCompany')}
          </Link>
        ) : (
          <Link to="/signup/customer" className="font-semibold">
            {t('auth.verify.changeEmail')}
          </Link>
        )
      }
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (code.length === OTP_LENGTH) verify.mutate(code);
        }}
        className="flex flex-col gap-6"
      >
        {state?.notice === 'unverified' && <Alert>{t('auth.login.unverified')}</Alert>}
        {verify.isError && <Alert tone="error">{t(errorKey(verify.error))}</Alert>}

        <OtpInput
          label={t('auth.verify.codeLabel')}
          value={code}
          onChange={setCode}
          onComplete={(value) => !busy && verify.mutate(value)}
          disabled={busy}
          focusOnMount
        />

        <Button
          type="submit"
          shape="form"
          fullWidth
          loading={busy}
          disabled={code.length !== OTP_LENGTH}
        >
          {t('auth.verify.submit')}
        </Button>

        <div className="text-center">
          <ResendCode
            initialCooldown={state?.cooldown ?? OTP_RESEND_COOLDOWN_SECONDS}
            send={() => authApi.resendOtp({ email, purpose: 'signup' })}
          />
        </div>
      </form>
    </AuthCard>
  );
}
