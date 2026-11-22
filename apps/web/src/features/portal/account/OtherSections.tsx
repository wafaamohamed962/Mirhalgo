import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, TriangleAlert } from 'lucide-react';
import {
  DELETE_CONFIRMATION,
  NOTIFICATION_EVENTS,
  deleteAccountSchema,
  type NotificationEvent,
} from '@mirhalgo/shared';
import { LanguageSwitch } from '../../../components/layout/LanguageSwitch';
import {
  Button,
  Input,
  Modal,
  PasswordInput,
  ProgressBar,
  QueryState,
  Select,
  Switch,
} from '../../../components/ui';
import { ComingSoon } from '../../../components/ui/ComingSoon';
import {
  DATE_FORMATS,
  setDateFormat,
  useDateFormat,
  type DateFormat,
} from '../../../lib/dateFormat';
import { useZodForm } from '../../../lib/forms';
import { portalApi } from '../../../services/api/portal';
import {
  keys,
  useApiMutation,
  useBalance,
  useNotificationPrefs,
} from '../../../services/api/queries';

/** Account › Notifications: in-app / email per event; security alerts are always on (spec B6). */
export function NotificationsSection() {
  const { t } = useTranslation();
  const prefs = useNotificationPrefs();
  const update = useApiMutation(
    ({
      event,
      channel,
      value,
    }: {
      event: NotificationEvent;
      channel: 'inApp' | 'email';
      value: boolean;
    }) => portalApi.updateNotificationPref(event, channel, value),
    { setData: keys.prefs, success: 'portal.prefs.saved' },
  );
  return (
    <QueryState query={prefs}>
      {(data) => (
        <div className="overflow-x-auto rounded-sm border border-slate-200">
          <table className="w-full min-w-md text-small">
            <thead className="bg-slate-50 text-muted">
              <tr>
                <th scope="col" className="p-3 text-start font-semibold">
                  {t('portal.prefs.event')}
                </th>
                <th scope="col" className="p-3 text-start font-semibold">
                  {t('portal.prefs.inApp')}
                </th>
                <th scope="col" className="p-3 text-start font-semibold">
                  {t('portal.prefs.email')}
                </th>
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_EVENTS.map((event) => {
                const locked = event === 'security';
                return (
                  <tr key={event} className="border-t border-slate-200">
                    <th scope="row" className="p-3 text-start font-normal text-heading">
                      {t(`portal.prefs.events.${event}`)}
                      {locked && (
                        <span className="block text-caption text-muted">
                          {t('portal.prefs.alwaysOn')}
                        </span>
                      )}
                    </th>
                    {(['inApp', 'email'] as const).map((channel) => (
                      <td key={channel} className="p-3">
                        <Switch
                          label={
                            <span className="sr-only">{`${t(`portal.prefs.events.${event}`)} · ${t(`portal.prefs.${channel}`)}`}</span>
                          }
                          checked={locked || data[event][channel]}
                          disabled={locked || update.isPending}
                          onChange={(e) =>
                            update.mutate({ event, channel, value: e.target.checked })
                          }
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </QueryState>
  );
}

/** Account › Requests balance (spec B6). */
export function BalanceSection() {
  const { t, i18n } = useTranslation();
  const { formatDate } = useDateFormat();
  const balance = useBalance();
  const n = (value: number) => value.toLocaleString(i18n.language);
  return (
    <QueryState query={balance}>
      {({ remaining, total, history }) => (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-5">
            <p className="font-semibold text-heading">
              {t('portal.attempts.remaining', { remaining: n(remaining), total: n(total) })}
            </p>
            <ProgressBar
              value={(remaining / total) * 100}
              tone={remaining ? 'primary' : 'error'}
              label={t('portal.attempts.label')}
            />
          </div>
          <section>
            <h3 className="mb-2 text-h3">{t('portal.balance.howTitle')}</h3>
            <ul className="list-disc ps-5 text-small text-body">
              {(['one', 'refund', 'monthly'] as const).map((key) => (
                <li key={key}>{t(`portal.balance.how.${key}`, { total: n(total) })}</li>
              ))}
            </ul>
          </section>
          <div className="overflow-x-auto rounded-sm border border-slate-200">
            <table className="w-full min-w-xl text-small">
              <thead className="bg-slate-50 text-muted">
                <tr>
                  {(['date', 'order', 'type', 'change', 'reason'] as const).map((col) => (
                    <th key={col} scope="col" className="p-3 text-start font-semibold">
                      {t(`portal.balance.cols.${col}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-200 text-heading">
                    <td className="p-3">{formatDate(entry.at)}</td>
                    <td dir="ltr" className="p-3 text-start font-mono">
                      {entry.orderReference ?? '—'}
                    </td>
                    <td className="p-3">{t(`portal.balance.types.${entry.type}`)}</td>
                    <td dir="ltr" className="p-3 text-start">
                      {`${n(entry.before)} → ${n(entry.after)}`}
                    </td>
                    <td className="p-3">{t(`portal.balance.reasons.${entry.reason}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </QueryState>
  );
}

/** Account › Language & preferences (spec B6, decision 21). */
export function PreferencesSection() {
  const { t } = useTranslation();
  const { format, formatDate } = useDateFormat();
  return (
    <div className="flex max-w-md flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <span className="text-small font-semibold text-heading">{t('portal.language')}</span>
        <LanguageSwitch />
      </div>
      <Select
        label={t('portal.prefs.dateFormat')}
        value={format}
        hint={t('portal.prefs.example', { date: formatDate(new Date().toISOString()) })}
        onChange={(event) => setDateFormat(event.target.value as DateFormat)}
        options={DATE_FORMATS.map((value) => ({
          value,
          label: t(`portal.prefs.dateFormats.${value}`),
        }))}
      />
    </div>
  );
}

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const form = useZodForm(deleteAccountSchema, { defaultValues: { password: '' } });
  const { errors } = form.formState;
  const remove = useApiMutation(portalApi.deleteAccount, {
    success: 'portal.privacy.deleteRequested',
    onSuccess: onClose,
  });
  return (
    <Modal
      title={t('portal.privacy.deleteTitle')}
      description={t('portal.privacy.deleteText')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" shape="form" onClick={onClose} data-autofocus>
            {t('ui.cancel')}
          </Button>
          <Button
            variant="danger"
            shape="form"
            loading={remove.isPending}
            onClick={form.handleSubmit((values) => remove.mutate(values))}
          >
            {t('portal.privacy.deleteConfirm')}
          </Button>
        </>
      }
    >
      <form noValidate className="flex flex-col gap-4">
        <Input
          label={t('portal.privacy.typeDelete', { word: DELETE_CONFIRMATION })}
          dir="ltr"
          autoComplete="off"
          required
          error={errors.confirmation?.message}
          {...form.register('confirmation')}
        />
        <PasswordInput
          label={t('auth.signup.password')}
          autoComplete="current-password"
          required
          error={errors.password?.message}
          {...form.register('password')}
        />
      </form>
    </Modal>
  );
}

/** Account › Privacy & data (spec B6). */
export function PrivacySection() {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);
  const exportData = useApiMutation(portalApi.requestDataExport, {
    success: 'portal.privacy.exportRequested',
  });
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col items-start gap-3">
        <h3 className="text-h3">{t('portal.privacy.exportTitle')}</h3>
        <p className="text-small text-body">{t('portal.privacy.exportText')}</p>
        <Button
          variant="secondary"
          shape="form"
          loading={exportData.isPending}
          onClick={() => exportData.mutate(undefined)}
        >
          <Download aria-hidden="true" className="size-4" />
          {t('portal.privacy.export')}
        </Button>
      </section>
      <section className="flex flex-wrap gap-4 text-small">
        {(['terms', 'privacy'] as const).map((page) => (
          <ComingSoon key={page} label={t(`footer.${page}`)}>
            <span className="font-semibold text-link">{t(`footer.${page}`)}</span>
          </ComingSoon>
        ))}
      </section>
      <section className="flex flex-col items-start gap-3 rounded-lg border-2 border-error p-5">
        <h3 className="inline-flex items-center gap-2 text-h3">
          <TriangleAlert aria-hidden="true" className="size-5 text-error" />
          {t('portal.privacy.dangerZone')}
        </h3>
        <p className="text-small text-body">{t('portal.privacy.dangerText')}</p>
        <Button variant="danger" shape="form" onClick={() => setDeleting(true)}>
          {t('portal.privacy.delete')}
        </Button>
      </section>
      {deleting && <DeleteAccountModal onClose={() => setDeleting(false)} />}
    </div>
  );
}
