import { useTranslation } from 'react-i18next';
import { Lock, Plane, Ship, Truck } from 'lucide-react';
import { SERVICE_SCOPES, SHIPPING_MODES } from '@mirhalgo/shared';
import { FormSection } from '../../../components/FormSection';
import { ChoiceField } from '../components/fields';
import { useLabel } from '../formContext';
import { useChoices } from '../options';

const MODE_ICONS = { sea: Ship, air: Plane, land: Truck } as const;

/** International Step 2 (spec B3): export / import only ("Domestic" is its own service). */
export function OperationStep() {
  const { t } = useTranslation();
  const label = useLabel();
  const choices = useChoices();
  return (
    <FormSection title={t('portal.request.steps.operation')} className="sm:grid-cols-1">
      <ChoiceField
        name="operation.operationType"
        label={label('operationType', true)}
        required
        variant="card"
        options={choices('operationType', ['export', 'import'] as const)}
      />
      <ChoiceField
        name="operation.serviceScope"
        label={label('serviceScope', true)}
        required
        variant="card"
        options={choices('serviceScope', SERVICE_SCOPES)}
      />
      <ChoiceField
        name="shipment.mode"
        label={label('mode', true)}
        required
        variant="card"
        options={choices('mode', SHIPPING_MODES).map((o) => ({ ...o, icon: MODE_ICONS[o.value] }))}
      />
    </FormSection>
  );
}

/** Domestic Step 2 (spec B4): fixed to Domestic · Land · Shipping only, shown read-only. */
export function DomesticOperationStep() {
  const { t } = useTranslation();
  const rows: Array<[string, string]> = [
    [t('portal.request.fields.operationType'), t('portal.request.options.operationType.domestic')],
    [t('portal.request.fields.mode'), t('portal.request.options.mode.land')],
    [t('portal.request.fields.serviceScope'), t('portal.request.options.serviceScope.shipping')],
  ];
  return (
    <FormSection title={t('portal.request.steps.operation')} className="sm:grid-cols-1">
      <dl className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-5 sm:grid-cols-3">
        {rows.map(([name, value]) => (
          <div key={name}>
            <dt className="text-caption text-muted">{name}</dt>
            <dd className="font-semibold text-heading">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="flex items-start gap-2 text-small text-muted">
        <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {t('portal.request.domesticFixed')}
      </p>
    </FormSection>
  );
}
