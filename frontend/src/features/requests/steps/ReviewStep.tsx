import { useFormContext, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { ORDER_LIMITS, type LocalizedName, type ServiceType } from '@mirhalgo/shared';
import { Alert, Checkbox } from '../../../components/ui';
import { localizedName, useReference } from '../../../services/api/reference';
import { useMeSummary } from '../../../services/api/queries';
import { TextField } from '../components/fields';
import { useFieldError, useLabel } from '../formContext';
import type { RequestStep } from '../model';
import { summarize } from '../summary';
import type { RequestWizard } from '../useRequestWizard';

/** Names of every reference list the summary may show (all cached). */
function useNames() {
  const { i18n } = useTranslation();
  const data = [
    ['countries', useReference('countries').data],
    ['regions', useReference('regions').data],
    ['cities', useReference('cities').data],
    ['ports', useReference('ports').data],
    ['airports', useReference('airports').data],
    ['container-types', useReference('container-types').data],
    ['truck-types', useReference('truck-types').data],
    ['shipping-lines', useReference('shipping-lines').data],
  ] as const;
  const maps = new Map(
    data.map(([list, items]) => [
      list as string,
      new Map(
        ((items ?? []) as Array<{ id?: string; code?: string; name: LocalizedName }>).map(
          (item) => [item.id ?? item.code!, item.name],
        ),
      ),
    ]),
  );
  return (list: string, id: string) => {
    const name = maps.get(list)?.get(id);
    return name && localizedName(name, i18n.language);
  };
}

/** Last step (spec B3 Step 6 / B5 Step 4): summary with Edit links, confirmation, balance. */
export function ReviewStep({ service, wizard }: { service: ServiceType; wizard: RequestWizard }) {
  const { t, i18n } = useTranslation();
  const { register } = useFormContext<FieldValues>();
  const names = useNames();
  const label = useLabel();
  const summary = useMeSummary().data;
  const confirmError = useFieldError('confirmAccuracy');
  const sections = summarize(service, wizard.pruned() as Record<string, unknown>, {
    t,
    language: i18n.language,
    names,
    uploads: wizard.uploads,
  });
  const remaining = summary?.balance.remaining;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body">{t('portal.request.reviewIntro')}</p>
      {wizard.steps
        .filter((step): step is Exclude<RequestStep, 'review'> => step !== 'review')
        .map((step) => {
          const rows = sections.get(step) ?? [];
          const title = t(`portal.request.steps.${step}`);
          return (
            <section key={step} className="rounded-lg border border-slate-200 p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-h3">{title}</h2>
                <button
                  type="button"
                  onClick={() => wizard.select(step)}
                  aria-label={t('portal.request.editSection', { section: title })}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-small font-semibold text-link hover:bg-blue-50"
                >
                  <Pencil aria-hidden="true" className="size-4" />
                  {t('portal.request.edit')}
                </button>
              </div>
              {rows.length ? (
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {rows.map((row, i) => (
                    <div key={`${row.label}-${i}`} className="flex min-w-0 flex-col">
                      <dt className="text-caption text-muted">{row.label}</dt>
                      <dd
                        dir="auto"
                        className="text-small break-words whitespace-pre-line text-heading"
                      >
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-small text-muted">{t('portal.request.nothingHere')}</p>
              )}
            </section>
          );
        })}

      {service === 'china' && (
        <TextField
          name="notes"
          label={label('notes')}
          multiline
          maxLength={ORDER_LIMITS.notesMax}
        />
      )}

      <Checkbox
        label={t('portal.request.confirmAccuracy')}
        required
        error={confirmError}
        {...register('confirmAccuracy')}
      />

      {remaining !== undefined &&
        (remaining > 0 ? (
          <Alert tone="info">
            {t('portal.request.balanceNotice', {
              remaining: remaining.toLocaleString(i18n.language),
            })}
          </Alert>
        ) : (
          <Alert tone="error">{t('portal.request.noBalance')}</Alert>
        ))}
    </div>
  );
}
