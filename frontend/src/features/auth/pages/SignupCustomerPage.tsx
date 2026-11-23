import { Controller } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import { GENDERS, signupSchema, type SignupInput } from '@mirhalgo/shared';
import {
  Alert,
  Button,
  Checkbox,
  Input,
  PasswordInput,
  PhoneInput,
  Select,
} from '../../../components/ui';
import { errorKey } from '../../../lib/apiClient';
import { hasChanges, useZodForm } from '../../../lib/forms';
import { usePageMeta } from '../../../lib/usePageMeta';
import { useUnsavedChangesGuard } from '../../../lib/useUnsavedChangesGuard';
import { authApi } from '../api';
import { AuthCard } from '../components/AuthCard';
import { setPendingVerification } from '../pendingVerification';

/**
 * Every field has a default equal to what the page shows (gender: the placeholder option,
 * terms: an unchecked box). Without one, react-hook-form compared '' / false with undefined and
 * marked gender and terms as changed, so "Back to home" asked to confirm after the user typed and
 * cleared a field (MW_003 A3). The schema still requires a gender and the box ticked.
 */
const DEFAULTS = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  gender: '' as SignupInput['gender'],
  acceptTerms: false as SignupInput['acceptTerms'],
};

/** /signup/customer (spec 4.2) → POST /api/auth/signup → /verify-email. */
export default function SignupCustomerPage() {
  const { t } = useTranslation();
  usePageMeta('signupCustomer');
  const navigate = useNavigate();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, dirtyFields },
  } = useZodForm(signupSchema, { defaultValues: DEFAULTS });

  // "Back to home" (or any link) with data typed: confirm first (MW_003 A3). No draft here.
  const leaveGuard = useUnsavedChangesGuard(hasChanges(dirtyFields), {
    title: t('auth.signup.leave.title'),
    description: t('auth.signup.leave.text'),
  });

  const signup = useMutation({
    mutationFn: authApi.signup,
    onSuccess: (result, input) => {
      setPendingVerification(result.email, input.password);
      leaveGuard.allowLeave();
      // replace: Back never returns to a submitted sign-up form
      navigate('/verify-email', { replace: true, state: { cooldown: result.cooldownSeconds } });
    },
  });

  return (
    <AuthCard
      back
      wide
      backHome
      title={t('auth.signup.title')}
      subtitle={t('auth.signup.subtitle')}
      footer={
        <>
          {t('auth.signup.haveAccount')}{' '}
          <Link to="/login" className="font-semibold">
            {t('auth.signup.login')}
          </Link>
        </>
      }
    >
      <form
        noValidate
        onSubmit={handleSubmit((values) => signup.mutate(values))}
        className="grid gap-5 sm:grid-cols-2"
      >
        {signup.isError && (
          <div className="sm:col-span-2">
            <Alert tone="error">{t(errorKey(signup.error))}</Alert>
          </div>
        )}

        <Input
          label={t('auth.signup.firstName')}
          autoComplete="given-name"
          required
          error={errors.firstName?.message}
          {...register('firstName')}
        />
        <Input
          label={t('auth.signup.lastName')}
          autoComplete="family-name"
          required
          error={errors.lastName?.message}
          {...register('lastName')}
        />
        <Input
          label={t('auth.signup.email')}
          type="email"
          autoComplete="email"
          dir="ltr"
          required
          error={errors.email?.message}
          {...register('email')}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <PhoneInput
              label={t('auth.signup.phone')}
              required
              error={errors.phone?.message}
              {...field}
            />
          )}
        />
        <Select
          label={t('auth.signup.gender')}
          placeholder={t('auth.signup.genderPlaceholder')}
          options={GENDERS.map((gender) => ({ value: gender, label: t(`auth.signup.${gender}`) }))}
          required
          error={errors.gender?.message}
          {...register('gender')}
        />
        <div className="hidden sm:block" />
        <PasswordInput
          label={t('auth.signup.password')}
          autoComplete="new-password"
          showStrength
          required
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordInput
          label={t('auth.signup.confirmPassword')}
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <div className="sm:col-span-2">
          <Checkbox
            label={
              <Trans
                i18nKey="auth.signup.terms"
                components={{
                  terms: <strong className="font-semibold text-heading" />,
                  privacy: <strong className="font-semibold text-heading" />,
                }}
              />
            }
            required
            error={errors.acceptTerms?.message}
            {...register('acceptTerms')}
          />
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" shape="form" fullWidth loading={signup.isPending}>
            {t('auth.signup.submit')}
          </Button>
        </div>
      </form>
      {leaveGuard.dialog}
    </AuthCard>
  );
}
