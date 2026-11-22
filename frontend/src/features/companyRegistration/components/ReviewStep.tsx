import type { ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { COMPANY_LIMITS, DOCUMENT_TYPES } from '@mirhalgo/shared';
import { Checkbox, Textarea } from '../../../components/ui';
import { formatFileSize } from '../../../lib/utils';
import { isStepSkipped, type CompanyFormValues, type StepId } from '../model';
import { labelsOf, useCompanyOptions } from '../options';

type Row = [label: string, value: ReactNode];

/** Read-only summary block with an "Edit" link to its step. */
function Summary({ title, rows, onEdit }: { title: string; rows: Row[]; onEdit: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="rounded-lg border border-slate-200 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-h3">{title}</h2>
        <button
          type="button"
          onClick={onEdit}
          aria-label={t('company.register.review.editSection', { section: title })}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-small font-semibold text-link hover:bg-blue-50"
        >
          <Pencil aria-hidden="true" className="size-4" />
          {t('company.register.review.edit')}
        </button>
      </div>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col">
            <dt className="text-caption text-muted">{label}</dt>
            <dd dir="auto" className="text-small break-words text-heading">
              {value || t('company.register.review.empty')}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Step 4: summary of every step + notes + the two confirmations (spec A2). */
export function ReviewStep({ goTo }: { goTo: (step: StepId) => void }) {
  const { t, i18n } = useTranslation();
  const options = useCompanyOptions();
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<CompanyFormValues>();
  const v = watch();
  const f = (key: string) => t(`company.register.fields.${key}`);
  const s = (key: string) => t(`company.register.sections.${key}`);
  const list = (opts: Parameters<typeof labelsOf>[0], values?: readonly string[]) =>
    labelsOf(opts, values, i18n.language);
  const activities = v.activities ?? [];
  const notesLength = v.notes?.length ?? 0;

  const services: Row[] = [];
  if (activities.includes('international')) {
    services.push(
      [`${s('international')}: ${f('modes')}`, list(options.modes, v.international?.modes)],
      [f('scope'), list(options.scopes, v.international?.scope ? [v.international.scope] : [])],
      [f('countries'), list(options.countries, v.international?.countries)],
      [f('regions'), list(options.regions, v.international?.regions)],
    );
  }
  if (activities.includes('domestic')) {
    services.push(
      [
        `${s('domestic')}: ${f('governorates')}`,
        v.domestic?.allGovernorates
          ? f('allGovernorates')
          : list(options.governorates, v.domestic?.governorates),
      ],
      [
        f('vehicleTypes'),
        [list(options.vehicles, v.domestic?.vehicleTypes), v.domestic?.vehicleTypeOther]
          .filter(Boolean)
          .join(' · '),
      ],
      [f('fleetSize'), String(v.domestic?.fleetSize ?? '')],
    );
  }
  if (activities.includes('china')) {
    services.push(
      [
        `${s('china')}: ${f('sites')}`,
        [list(options.chinaSites, v.china?.sites), v.china?.siteOther].filter(Boolean).join(' · '),
      ],
      [f('chinaServices'), list(options.chinaServices, v.china?.services)],
    );
  }
  services.push([f('yearsInBusiness'), String(v.yearsInBusiness ?? '')]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body">{t('company.register.review.intro')}</p>

      <Summary
        title={t('company.register.steps.account')}
        onEdit={() => goTo('account')}
        rows={[
          [f('legalName'), v.legalName],
          [f('representativeName'), `${v.representativeName} · ${v.representativeTitle}`],
          [f('email'), <span dir="ltr">{v.email}</span>],
          [f('phone'), <span dir="ltr">{v.phone}</span>],
          [f('whatsapp'), <span dir="ltr">{v.whatsappSameAsMobile ? v.phone : v.whatsapp}</span>],
          [f('landline'), <span dir="ltr">{v.landline}</span>],
          [f('website'), <span dir="ltr">{v.website}</span>],
          [
            s('address'),
            new Intl.ListFormat(i18n.language, { type: 'unit' }).format(
              [v.street, v.city, v.governorate && t(`options.governorate.${v.governorate}`)].filter(
                (part): part is string => Boolean(part),
              ),
            ),
          ],
          [f('password'), t('company.register.review.hidden')],
          [
            s('activities'),
            [list(options.activities, activities), v.otherActivity].filter(Boolean).join(' · '),
          ],
        ]}
      />

      {!isStepSkipped('services', activities) && (
        <Summary
          title={t('company.register.steps.services')}
          onEdit={() => goTo('services')}
          rows={services}
        />
      )}

      <Summary
        title={t('company.register.steps.documents')}
        onEdit={() => goTo('documents')}
        rows={[
          [f('commercialRegisterNumber'), <span dir="ltr">{v.commercialRegisterNumber}</span>],
          [f('taxNumber'), <span dir="ltr">{v.taxNumber}</span>],
          ...DOCUMENT_TYPES.map((type): Row => {
            const file = v.files?.[type];
            return [
              t(`options.document.${type}`),
              file
                ? `${file.name} (${formatFileSize(file.size, i18n.language)})`
                : t('company.register.review.notUploaded'),
            ];
          }),
        ]}
      />

      <Textarea
        label={f('notes')}
        rows={4}
        maxLength={COMPANY_LIMITS.notesMax}
        error={errors.notes?.message}
        {...register('notes')}
      />
      <p aria-live="polite" className="-mt-4 text-end text-caption text-muted">
        {t('company.register.fields.notesCounter', {
          count: notesLength,
          max: COMPANY_LIMITS.notesMax,
        })}
      </p>

      <div className="flex flex-col gap-3">
        <Checkbox
          label={f('declaration')}
          required
          error={errors.confirmAccuracy?.message}
          {...register('confirmAccuracy')}
        />
        <Checkbox
          label={
            <Trans
              i18nKey="company.register.fields.terms"
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
    </div>
  );
}
