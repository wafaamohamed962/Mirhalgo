import { useTranslation } from 'react-i18next';
import { CircleCheck, CircleX, Monitor } from 'lucide-react';
import { changePasswordSchema, type ChangePasswordInput } from '@mirhalgo/shared';
import { Button, PasswordInput, QueryState } from '../../../components/ui';
import { ComingSoon } from '../../../components/ui/ComingSoon';
import { useDateFormat } from '../../../lib/dateFormat';
import { useZodForm } from '../../../lib/forms';
import { portalApi } from '../../../services/api/portal';
import { keys, useApiMutation, useSecurity } from '../../../services/api/queries';

const EMPTY: ChangePasswordInput = { currentPassword: '', password: '', confirmPassword: '' };

function ChangePassword() {
  const { t } = useTranslation();
  const form = useZodForm(changePasswordSchema, { defaultValues: EMPTY });
  const { errors } = form.formState;
  const change = useApiMutation(portalApi.changePassword, {
    success: 'portal.security.passwordChanged',
    onSuccess: () => form.reset(EMPTY),
  });
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => change.mutate(values))}
      className="grid gap-5 sm:grid-cols-2"
    >
      <div className="sm:col-span-2 sm:max-w-sm">
        <PasswordInput
          label={t('portal.security.current')}
          autoComplete="current-password"
          required
          error={errors.currentPassword?.message}
          {...form.register('currentPassword')}
        />
      </div>
      <PasswordInput
        label={t('portal.security.new')}
        autoComplete="new-password"
        showStrength
        required
        error={errors.password?.message}
        {...form.register('password')}
      />
      <PasswordInput
        label={t('auth.signup.confirmPassword')}
        autoComplete="new-password"
        required
        error={errors.confirmPassword?.message}
        {...form.register('confirmPassword')}
      />
      <Button type="submit" shape="form" className="justify-self-start" loading={change.isPending}>
        {t('portal.security.changePassword')}
      </Button>
    </form>
  );
}

/** Account › Security (spec B6). */
export function SecuritySection() {
  const { t } = useTranslation();
  const { formatDate } = useDateFormat();
  const security = useSecurity();
  const logoutOthers = useApiMutation(portalApi.logoutOtherSessions, {
    setData: keys.security,
    success: 'portal.security.loggedOut',
  });

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h3 className="text-h3">{t('portal.security.changePassword')}</h3>
        <ChangePassword />
      </section>

      <QueryState query={security}>
        {({ sessions, activity }) => (
          <>
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-h3">{t('portal.security.sessions')}</h3>
                <Button
                  variant="secondary"
                  shape="form"
                  loading={logoutOthers.isPending}
                  disabled={sessions.length <= 1}
                  onClick={() => logoutOthers.mutate(undefined)}
                >
                  {t('portal.security.logoutOthers')}
                </Button>
              </div>
              <ul className="flex flex-col gap-2">
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center gap-3 rounded-sm border border-slate-200 p-3"
                  >
                    <Monitor aria-hidden="true" className="size-5 shrink-0 text-muted" />
                    <div className="min-w-0 flex-1 text-small">
                      <p className="font-semibold text-heading">
                        {session.device} · {session.browser}
                        {session.current && (
                          <span className="ms-2 rounded-full bg-blue-50 px-2 text-caption text-blue-600">
                            {t('portal.security.thisDevice')}
                          </span>
                        )}
                      </p>
                      <p className="text-muted">
                        {session.location} ·{' '}
                        {t('portal.security.lastActive', {
                          date: formatDate(session.lastActive, true),
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-h3">{t('portal.security.activity')}</h3>
              <div className="relative overflow-x-auto rounded-sm border border-slate-200">
                <table className="w-full min-w-lg text-small">
                  <thead className="bg-slate-50 text-muted">
                    <tr>
                      {(['date', 'device', 'location', 'result'] as const).map((col) => (
                        <th key={col} scope="col" className="p-3 text-start font-semibold">
                          {t(`portal.security.cols.${col}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((entry) => (
                      <tr key={entry.id} className="border-t border-slate-200 text-heading">
                        <td className="p-3">{formatDate(entry.at, true)}</td>
                        <td className="p-3">{entry.device}</td>
                        <td className="p-3">{entry.location}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1">
                            {entry.success ? (
                              <CircleCheck aria-hidden="true" className="size-4 text-success" />
                            ) : (
                              <CircleX aria-hidden="true" className="size-4 text-error" />
                            )}
                            {t(
                              entry.success ? 'portal.security.success' : 'portal.security.failed',
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </QueryState>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-4">
        <div>
          <h3 className="font-semibold text-heading">{t('portal.security.twoFactor')}</h3>
          <p className="text-small text-body">{t('portal.security.twoFactorText')}</p>
        </div>
        <ComingSoon label={t('portal.security.twoFactor')}>
          <span className="inline-flex min-h-11 items-center rounded-sm border-2 border-slate-200 px-4 text-small font-semibold text-muted">
            {t('portal.security.enable')}
          </span>
        </ComingSoon>
      </section>
    </div>
  );
}
