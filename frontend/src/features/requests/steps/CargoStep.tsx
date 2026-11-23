import { useEffect, type ReactNode } from 'react';
import { useFieldArray, useFormContext, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import {
  INPUT_METHODS,
  ORDER_LIMITS,
  PACKAGING_TYPES,
  cairoToday,
  toAsciiDigits,
  type ServiceType,
} from '@mirhalgo/shared';
import { FormSection, Full } from '../../../components/FormSection';
import { Button } from '../../../components/ui';
import {
  ChoiceField,
  CodeField,
  DimensionsField,
  MoneyField,
  NumberField,
  PlaceField,
  TextField,
  UploadField,
  WeightField,
  YesNoField,
} from '../components/fields';
import { useFieldError, useLabel } from '../formContext';
import { useChoices, useTypeOptions } from '../options';

type Kind = 'containers' | 'trucks' | 'ltl' | 'loose';

/** The cargo the route asks for (spec B3 Step 4 / B4). */
function useCargoKind(service: ServiceType): { kind: Kind | null; mode?: string } {
  const { watch } = useFormContext<FieldValues>();
  const mode: string | undefined = service === 'domestic' ? 'land' : watch('shipment.mode');
  const seaType: string | undefined = watch('shipment.seaType');
  const landType: string | undefined = watch('shipment.landType');
  const loadType: string | undefined = watch('shipment.loadType');
  if (mode === 'sea')
    return { kind: seaType === 'fcl' ? 'containers' : seaType === 'lcl' ? 'loose' : null, mode };
  if (mode === 'air') return { kind: 'loose', mode };
  if (mode === 'land') {
    if (landType === 'container') return { kind: 'containers', mode };
    if (landType === 'general')
      return { kind: loadType === 'ftl' ? 'trucks' : loadType === 'ltl' ? 'ltl' : null, mode };
  }
  return { kind: null, mode };
}

const number = (value: unknown) => {
  const n = Number(toAsciiDigits(String(value ?? '')).replace(/\u066B/g, '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** "Total containers: 5" etc., live (the server computes the stored totals). */
function Total({ label, value }: { label: string; value: string }) {
  return (
    <p
      aria-live="polite"
      className="rounded-sm bg-blue-50 px-4 py-2 text-small font-semibold text-heading"
    >
      {label}: <span dir="ltr">{value}</span>
    </p>
  );
}

/** Repeatable group card with its remove button. */
function GroupCard({
  title,
  onRemove,
  removeLabel,
  children,
}: {
  title: string;
  onRemove?: () => void;
  removeLabel: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <legend className="font-semibold text-heading">{title}</legend>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeLabel}
            className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-slate-50 hover:text-error"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function useGroups(name: string, empty: FieldValues) {
  const { control } = useFormContext<FieldValues>();
  const array = useFieldArray({ control, name });
  // a list hidden and shown again starts with one row (min 1, spec B3)
  useEffect(() => {
    if (array.fields.length === 0) array.append(empty, { shouldFocus: false });
  }, [array, empty]);
  return array;
}

const EMPTY_GROUP = { count: '1' };
const EMPTY_ITEM = { cartons: '1', weight: { unit: 'kg' } };

function ContainerGroups({ prices }: { prices: boolean }) {
  const { t, i18n } = useTranslation();
  const label = useLabel();
  const { watch } = useFormContext<FieldValues>();
  const groups = useGroups('shipment.cargo.groups', EMPTY_GROUP);
  const types = useTypeOptions('container-types');
  const lines = useTypeOptions('shipping-lines');
  const total = ((watch('shipment.cargo.groups') ?? []) as FieldValues[]).reduce(
    (sum, g) => sum + number(g.count),
    0,
  );
  const error = useFieldError('shipment.cargo.groups');
  return (
    <div className="flex flex-col gap-4">
      {groups.fields.map((group, i) => (
        <GroupCard
          key={group.id}
          title={t('portal.request.containerGroup', { n: i + 1 })}
          removeLabel={t('portal.request.removeGroup', { n: i + 1 })}
          onRemove={groups.fields.length > 1 ? () => groups.remove(i) : undefined}
        >
          <CodeField
            name={`shipment.cargo.groups.${i}.containerType`}
            label={label('containerType', true)}
            required
            options={types.options}
            loading={types.loading}
          />
          <NumberField
            name={`shipment.cargo.groups.${i}.count`}
            label={label('count', true)}
            required
          />
          <Full>
            <TextField
              name={`shipment.cargo.groups.${i}.description`}
              label={label('groupDescription', true)}
              required
              maxLength={500}
            />
          </Full>
          <WeightField
            name={`shipment.cargo.groups.${i}.weightPerContainer`}
            label={label('weightPerContainer')}
          />
          <PlaceField
            name={`shipment.cargo.groups.${i}.shippingLine`}
            label={label('shippingLine')}
            options={lines.options}
            loading={lines.loading}
          />
          {prices && (
            <MoneyField
              name={`shipment.cargo.groups.${i}.targetPrice`}
              label={label('targetPrice')}
            />
          )}
        </GroupCard>
      ))}
      {error && <p className="text-caption text-error">{t(error)}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="secondary"
          shape="form"
          disabled={groups.fields.length >= ORDER_LIMITS.groups}
          onClick={() => groups.append(EMPTY_GROUP)}
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('portal.request.addContainerGroup')}
        </Button>
        <Total
          label={t('portal.request.totalContainers')}
          value={total.toLocaleString(i18n.language)}
        />
      </div>
    </div>
  );
}

function TruckGroups() {
  const { t, i18n } = useTranslation();
  const label = useLabel();
  const choices = useChoices();
  const { watch } = useFormContext<FieldValues>();
  const groups = useGroups('shipment.cargo.groups', EMPTY_GROUP);
  const types = useTypeOptions('truck-types');
  const total = ((watch('shipment.cargo.groups') ?? []) as FieldValues[]).reduce(
    (sum, g) => sum + number(g.count),
    0,
  );
  return (
    <div className="flex flex-col gap-4">
      {groups.fields.map((group, i) => (
        <GroupCard
          key={group.id}
          title={t('portal.request.truckGroup', { n: i + 1 })}
          removeLabel={t('portal.request.removeGroup', { n: i + 1 })}
          onRemove={groups.fields.length > 1 ? () => groups.remove(i) : undefined}
        >
          <CodeField
            name={`shipment.cargo.groups.${i}.truckType`}
            label={label('truckType', true)}
            required
            options={types.options}
            loading={types.loading}
          />
          <NumberField
            name={`shipment.cargo.groups.${i}.count`}
            label={label('truckCount', true)}
            required
          />
          <Full>
            <TextField
              name={`shipment.cargo.groups.${i}.description`}
              label={label('groupDescription', true)}
              required
              maxLength={500}
            />
          </Full>
          <WeightField name={`shipment.cargo.groups.${i}.weight`} label={label('groupWeight')} />
        </GroupCard>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="secondary"
          shape="form"
          disabled={groups.fields.length >= ORDER_LIMITS.groups}
          onClick={() => groups.append(EMPTY_GROUP)}
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('portal.request.addTruckGroup')}
        </Button>
        <Total
          label={t('portal.request.totalTrucks')}
          value={total.toLocaleString(i18n.language)}
        />
      </div>
      <ChoiceField
        name="shipment.cargo.packaging"
        label={label('packaging', true)}
        required
        options={choices('packaging', PACKAGING_TYPES)}
      />
      {watch('shipment.cargo.packaging') === 'other' && (
        <TextField
          name="shipment.cargo.packagingOther"
          label={label('packagingOther', true)}
          required
        />
      )}
    </div>
  );
}

/** LCL / air products: weight, cartons, dimensions, hazardous (+ MSDS) per product. */
function LooseItems({ air }: { air: boolean }) {
  const { t, i18n } = useTranslation();
  const label = useLabel();
  const { watch } = useFormContext<FieldValues>();
  const items = useGroups('shipment.cargo.items', EMPTY_ITEM);
  const values = (watch('shipment.cargo.items') ?? []) as FieldValues[];
  const volume = (item: FieldValues) => {
    const d = item?.dimensions ?? {};
    return number(d.length) * number(d.width) * number(d.height) * number(item?.cartons);
  };
  const fmt = (n: number, digits: number) =>
    n.toLocaleString(i18n.language, { maximumFractionDigits: digits });
  const totalCbm = values.reduce((sum, item) => sum + volume(item) / 1_000_000, 0);
  const error = useFieldError('shipment.cargo.items');
  return (
    <div className="flex flex-col gap-4">
      {items.fields.map((item, i) => (
        <GroupCard
          key={item.id}
          title={t('portal.request.product', { n: i + 1 })}
          removeLabel={t('portal.request.removeProduct', { n: i + 1 })}
          onRemove={items.fields.length > 1 ? () => items.remove(i) : undefined}
        >
          <Full>
            <TextField
              name={`shipment.cargo.items.${i}.description`}
              label={label('itemDescription', true)}
              required
              maxLength={200}
            />
          </Full>
          <WeightField
            name={`shipment.cargo.items.${i}.weight`}
            label={label('totalWeight', true)}
            required
          />
          <NumberField
            name={`shipment.cargo.items.${i}.cartons`}
            label={label('cartons', true)}
            required
          />
          <Full>
            <DimensionsField name={`shipment.cargo.items.${i}.dimensions`} required />
          </Full>
          <Full>
            <p className="text-small text-muted">
              {t('portal.request.itemCbm', { value: fmt(volume(values[i] ?? {}) / 1_000_000, 3) })}
              {air &&
                ` · ${t('portal.request.volumetricWeight', { value: fmt(volume(values[i] ?? {}) / 6000, 2) })}`}
            </p>
          </Full>
          <Full>
            <YesNoField
              name={`shipment.cargo.items.${i}.hazardous`}
              label={label('itemHazardous', true)}
              required
            />
          </Full>
          {values[i]?.hazardous === 'yes' && (
            <Full>
              <UploadField
                name={`shipment.cargo.items.${i}.msdsUploadId`}
                label={label('msds', true)}
                purpose="msds"
                required
              />
            </Full>
          )}
        </GroupCard>
      ))}
      {error && <p className="text-caption text-error">{t(error)}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="secondary"
          shape="form"
          disabled={items.fields.length >= ORDER_LIMITS.items}
          onClick={() => items.append(EMPTY_ITEM)}
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('portal.request.addProduct')}
        </Button>
        <Total label={t('portal.request.totalCbm')} value={fmt(totalCbm, 3)} />
      </div>
      {air && <p className="text-caption text-muted">{t('portal.request.volumetricNote')}</p>}
    </div>
  );
}

function Hazard({ name = 'shipment.cargo' }: { name?: string }) {
  const { t } = useTranslation();
  const label = useLabel();
  const { watch } = useFormContext<FieldValues>();
  return (
    <>
      <Full>
        <YesNoField
          name={`${name}.hazardous`}
          label={label('hazardous', true)}
          required
          hint={t('portal.request.fields.hazardousHint')}
        />
      </Full>
      {watch(`${name}.hazardous`) === 'yes' && (
        <Full>
          <UploadField
            name={`${name}.msdsUploadId`}
            label={label('msds', true)}
            purpose="msds"
            required
          />
        </Full>
      )}
    </>
  );
}

/** Step 4 (spec B3 / B4): cargo by kind + ready date, value and shipment documents. */
export function CargoStep({ service }: { service: ServiceType }) {
  const { t } = useTranslation();
  const label = useLabel();
  const choices = useChoices();
  const { watch } = useFormContext<FieldValues>();
  const { kind, mode } = useCargoKind(service);
  const method: string | undefined = watch('shipment.cargo.inputMethod');
  const insurance = Boolean(watch('services.insurance'));

  return (
    <div className="flex flex-col gap-8">
      <FormSection title={t('portal.request.sections.cargo')} className="sm:grid-cols-1">
        {!kind && <p className="text-body">{t('portal.request.chooseRouteFirst')}</p>}
        {kind === 'containers' && <ContainerGroups prices={mode === 'sea'} />}
        {kind === 'trucks' && <TruckGroups />}
        {(kind === 'ltl' || kind === 'loose') && (
          <>
            <TextField
              name="shipment.cargo.description"
              label={label('cargoDescription', true)}
              required
              maxLength={500}
            />
            <ChoiceField
              name="shipment.cargo.inputMethod"
              label={label('inputMethod', true)}
              required
              variant="card"
              options={choices('inputMethod', INPUT_METHODS)}
            />
          </>
        )}
        {kind === 'ltl' && method === 'manual' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <WeightField
              name="shipment.cargo.totalWeight"
              label={label('totalWeight', true)}
              required
            />
            <NumberField name="shipment.cargo.pieces" label={label('pieces', true)} required />
            <NumberField name="shipment.cargo.volumeCbm" label={label('volumeCbm')} decimal />
            <Full>
              <DimensionsField name="shipment.cargo.dimensions" />
            </Full>
          </div>
        )}
        {kind === 'loose' && method === 'manual' && <LooseItems air={mode === 'air'} />}
        {(kind === 'ltl' || kind === 'loose') && method === 'packing_list' && (
          <UploadField
            name="shipment.cargo.packingListUploadId"
            label={label('packingListFile', true)}
            purpose="packing_list"
            required
          />
        )}
      </FormSection>

      {kind && (kind !== 'loose' || method === 'packing_list') && (
        <FormSection title={t('portal.request.sections.hazardous')}>
          <Hazard />
        </FormSection>
      )}

      <FormSection title={t('portal.request.sections.schedule')}>
        <TextField
          name="readyDate"
          label={label('readyDate', true)}
          required
          type="date"
          min={cairoToday()}
        />
        <MoneyField
          name="cargoValue"
          label={label('cargoValue', insurance)}
          required={insurance}
          hint={insurance ? t('portal.request.valueForInsurance') : undefined}
        />
      </FormSection>

      <FormSection title={t('portal.request.sections.documents')}>
        <UploadField
          name="shipmentDocuments.commercialInvoice"
          label={label('commercialInvoice')}
          purpose="invoice"
          max={5}
        />
        <UploadField
          name="shipmentDocuments.packingList"
          label={label('packingList')}
          purpose="packing_list"
          max={5}
        />
        <UploadField
          name="shipmentDocuments.draftBl"
          label={label('draftBl')}
          purpose="document"
          max={5}
        />
        <UploadField
          name="shipmentDocuments.other"
          label={label('otherDocuments')}
          purpose="document"
          max={5}
        />
      </FormSection>
    </div>
  );
}
