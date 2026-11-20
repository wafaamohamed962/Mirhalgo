import { Link, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { loginSchema, type LoginInput } from '@mirhalgo/shared';
import { Alert, Button, Input, PasswordInput } from '../../../components/ui';
import { errorKey } from '../../../lib/apiClient';
import { useZodForm } from '../../../lib/forms';
import { usePageMeta } from '../../../lib/usePageMeta';
import { AuthCard } from '../components/AuthCard';
import { useLogin } from '../hooks/useLogin';
import { setPendingVerification } from '../pendingVerification';

/** Messages other pages can show here via navigation state. */
export type LoginFlash = 'resetSuccess' | 'verifiedLogin';
const FLASH_KEYS: Record<LoginFlash, string> = {
  resetSuccess: 'auth.login.resetSuccess',
  verifiedLogin: 'auth.verify.verifiedLogin',
};

/** /login (spec 4.4): email OR phone + password. Errors are always generic. */
export default function LoginPage() {
  const { t } = useTranslation();
  usePageMeta('login');
  const navigate = useNavigate();
  const flash = (useLocation().state as { flash?: LoginFlash } | null)?.flash;
  const login = useLogin();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useZodForm(loginSchema, { defaultValues: { identifier: '', password: '' } });

  // handleSubmit validates; the API gets the raw input (it re-parses with the same schema).
  const onSubmit = handleSubmit(() => {
    const input: LoginInput = getValues();
    login.mutate(input, {
      onSuccess: (result) => {
        if (result.status === 'authenticated') return navigate('/dashboard', { replace: true });
        // right password, unverified email: a fresh code was sent (spec 4.4)
        setPendingVerification(result.email, input.password);
        navigate('/verify-email', { state: { notice: 'unverified' } });
      },
    });
  });

  return (
    <AuthCard
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.noAccount')}{' '}
          <Link to="/signup" className="font-semibold">
            {t('auth.login.signup')}
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {flash && <Alert tone="success">{t(FLASH_KEYS[flash])}</Alert>}
        {login.isError && <Alert tone="error">{t(errorKey(login.error))}</Alert>}

        <Input
          label={t('auth.login.identifier')}
          autoComplete="username"
          dir="auto"
          required
          error={errors.identifier?.message}
          {...register('identifier')}
        />
        <div className="flex flex-col gap-1">
          <PasswordInput
            label={t('auth.login.password')}
            autoComplete="current-password"
            required
            error={errors.password?.message}
            {...register('password')}
          />
          <Link to="/forgot-password" className="self-end text-small font-semibold">
            {t('auth.login.forgot')}
          </Link>
        </div>

        <Button type="submit" shape="form" fullWidth loading={login.isPending}>
          {t('auth.login.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}
