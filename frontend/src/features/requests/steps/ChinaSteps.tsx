import { useEffect } from 'react';
import { useFieldArray, useFormContext, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import {
  ADD_METHODS,
  CHINA_SHIPPING_METHODS,
  CHINA_SOURCES,
  CHINESE_SITES,
  ORDER_FILE_LIMITS,
  ORDER_LIMITS,
  SHEIN_SITES,
  TRANSIT_SOURCE_OF,
  toAsciiDigits,
  type ChinaSource,
} from '@mirhalgo/shared';
import { FormSection, Full } from '../../../components/FormSection';
import { Button } from '../../../components/ui';
import { useReference } from '../../../services/api/reference';
import {
  ChoiceField,
  NumberField,
  PhoneField,
  PlaceField,
  SwitchField,
  TextField,
  UploadField,
} from '../components/fields';
import { useFieldError, useLabel } from '../formContext';
import { useChoices, useCountryOptions, usePlaceOptions } from '../options';

/** Colours or sizes of one product: {value, quantity}; the quantities must add up (spec B5). */
function Variants({ product, kind }: { product: number; kind: 'colors' | 'sizes' }) {
  const { t } = useTranslation();
  const label = useLabel();
  const { control } = useFormContext<FieldValues>();
  const name = `order.products.${product}.${kind}`;
  const list = useFieldArray({ control, name });
  const error = useFieldError(name);
  useEffect(() => {
    if (list.fields.length === 0) list.append({ value: '', quantity: '' }, { shouldFocus: false });
  }, [list]);
  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      {list.fields.map((row, i) => (
        <div key={row.id} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
          <TextField
            name={`${name}.${i}.value`}
            label={label(kind === 'colors' ? 'color' : 'size', true)}
            required
            maxLength={40}
          />
          <NumberField name={`${name}.${i}.quantity`} label={label('quantity', true)} required />
          <button
            type="button"
            onClick={() => list.remove(i)}
            disabled={list.fields.length === 1}
            aria-label={t('portal.request.removeRow', { n: i + 1 })}
            className="mb-1 flex size-10 items-center justify-center rounded-full text-muted hover:bg-slate-50 disabled:opacity-40"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      ))}
      {error && <p className="text-caption text-error">{t(error)}</p>}
      <Button
        variant="ghost"
        shape="form"
        disabled={list.fields.length >= ORDER_LIMITS.variants}
        onClick={() => list.append({ value: '', quantity: '' })}
      >
        <Plus aria-hidden="true" className="size-4" />
        {t(kind === 'colors' ? 'portal.request.addColor' : 'portal.request.addSize')}
      </Button>
    </div>
  );
}

function Products() {
  const { t, i18n } = useTranslation();
  const label = useLabel();
  const { control, watch } = useFormContext<FieldValues>();
  const products = useFieldArray({ control, name: 'order.products' });
  const values = (watch('order.products') ?? []) as FieldValues[];
  const error = useFieldError('order.products');
  useEffect(() => {
    if (products.fields.length === 0) products.append({ quantity: '1' }, { shouldFocus: false });
  }, [products]);
  const sum = (list?: FieldValues[]) =>
    (list ?? []).reduce(
      (total, v) => total + (Number(toAsciiDigits(String(v.quantity ?? ''))) || 0),
      0,
    );

  return (
    <div className="flex flex-col gap-4">
      {products.fields.map((product, i) => {
        const value = values[i] ?? {};
        return (
          <fieldset
            key={product.id}
            className="grid gap-4 rounded-lg border border-slate-200 p-4 sm:grid-cols-2"
          >
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <legend className="font-semibold text-heading">
                {t('portal.request.product', { n: i + 1 })}
              </legend>
              {products.fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => products.remove(i)}
                  aria-label={t('portal.request.removeProduct', { n: i + 1 })}
                  className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-slate-50 hover:text-error"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              )}
            </div>
            <Full>
              <TextField
                name={`order.products.${i}.url`}
                label={label('productUrl')}
                dir="ltr"
                inputMode="url"
                hint={t('portal.request.productUrlOrName')}
              />
            </Full>
            <TextField
              name={`order.products.${i}.name`}
              label={label('productName')}
              maxLength={200}
            />
            <NumberField
              name={`order.products.${i}.quantity`}
              label={label('quantity', true)}
              required
            />
            <Full>
              <SwitchField
                name={`order.products.${i}.hasColors`}
                label={t('portal.request.fields.hasColors')}
              />
            </Full>
            {value.hasColors && <Variants product={i} kind="colors" />}
            <Full>
              <SwitchField
                name={`order.products.${i}.hasSizes`}
                label={t('portal.request.fields.hasSizes')}
              />
            </Full>
            {value.hasSizes && <Variants product={i} kind="sizes" />}
            {(value.hasColors || value.hasSizes) && (
              <p className="text-caption text-muted sm:col-span-2">
                {t('portal.request.variantTotals', {
                  colors: sum(value.colors).toLocaleString(i18n.language),
                  sizes: sum(value.sizes).toLocaleString(i18n.language),
                  quantity: (
                    Number(toAsciiDigits(String(value.quantity ?? ''))) || 0
                  ).toLocaleString(i18n.language),
                })}
              </p>
            )}
            <Full>
              <TextField
                name={`order.products.${i}.notes`}
                label={label('productNotes')}
                multiline
                maxLength={500}
              />
            </Full>
          </fieldset>
        );
      })}
      {error && <p className="text-caption text-error">{t(error)}</p>}
      <Button
        variant="secondary"
        shape="form"
        disabled={products.fields.length >= ORDER_LIMITS.chinaProducts.max}
        onClick={() => products.append({ quantity: '1' })}
      >
        <Plus aria-hidden="true" className="size-4" />
        {t('portal.request.addProduct')}
      </Button>
    </div>
  );
}

/** China Step 2 (spec B5): source, site, how the products are added. */
export function ChinaOrderStep() {
  const { t } = useTranslation();
  const label = useLabel();
  const choices = useChoices();
  const { watch } = useFormContext<FieldValues>();
  const source: string | undefined = watch('order.source');
  const site: string | undefined = watch('order.chineseSite');
  const method: string | undefined = watch('order.addMethod');
  return (
    <div className="flex flex-col gap-8">
      <FormSection title={t('portal.request.sections.source')} className="sm:grid-cols-1">
        <ChoiceField
          name="order.source"
          label={label('source', true)}
          required
          variant="card"
          options={choices('source', CHINA_SOURCES)}
        />
        {source === 'shein' && (
          <ChoiceField
            name="order.sheinSite"
            label={label('sheinSite', true)}
            required
            options={choices('sheinSite', SHEIN_SITES)}
          />
        )}
        {source === 'chinese_sites' && (
          <ChoiceField
            name="order.chineseSite"
            label={label('chineseSite', true)}
            required
            options={choices('chineseSite', CHINESE_SITES)}
          />
        )}
        {source === 'chinese_sites' && site === 'other' && (
          <TextField
            name="order.chineseSiteOther"
            label={label('chineseSiteOther', true)}
            required
            maxLength={300}
          />
        )}
      </FormSection>
      <FormSection title={t('portal.request.sections.products')} className="sm:grid-cols-1">
        <ChoiceField
          name="order.addMethod"
          label={label('addMethod', true)}
          required
          variant="card"
          options={choices('addMethod', ADD_METHODS)}
        />
        {method === 'cart_link' && (
          <TextField
            name="order.cartLink"
            label={label('cartLink', true)}
            required
            dir="ltr"
            inputMode="url"
            hint={t('portal.request.cartLinkHint')}
          />
        )}
        {method === 'screenshots' && (
          <UploadField
            name="order.screenshotUploadIds"
            label={label('screenshots', true)}
            purpose="screenshot"
            max={ORDER_FILE_LIMITS.screenshotsPerOrder}
            required
            hint={t('portal.request.screenshotsHint')}
          />
        )}
        {method === 'manual' && <Products />}
      </FormSection>
    </div>
  );
}

/** China Step 3 (spec B5): method (with configured durations), delivery and receiver. */
export function ChinaDeliveryStep() {
  const { t, i18n } = useTranslation();
  const label = useLabel();
  const choices = useChoices();
  const { watch } = useFormContext<FieldValues>();
  const source = watch('order.source') as ChinaSource | undefined;
  const country = watch('delivery.country') as { id?: string; isOther?: boolean } | undefined;
  const countries = useCountryOptions('china_delivery');
  const cities = usePlaceOptions('cities', country?.isOther ? undefined : country?.id);
  const estimates = useReference('transit-estimates').data ?? [];
  const methods = source ? CHINA_SHIPPING_METHODS[source] : [];
  const days = (method: string) => {
    const e = estimates.find(
      (x) => source && x.source === TRANSIT_SOURCE_OF[source] && x.method === method,
    );
    return e
      ? t('portal.request.transitDays', {
          min: e.minDays.toLocaleString(i18n.language),
          max: e.maxDays.toLocaleString(i18n.language),
        })
      : undefined;
  };
  return (
    <div className="flex flex-col gap-8">
      <FormSection title={t('portal.request.sections.shippingMethod')} className="sm:grid-cols-1">
        {source ? (
          <ChoiceField
            name="delivery.shippingMethod"
            label={label('shippingMethod', true)}
            required
            variant="card"
            options={choices('mode', methods).map((o) => ({ ...o, description: days(o.value) }))}
          />
        ) : (
          <p className="text-body">{t('portal.request.chooseSourceFirst')}</p>
        )}
        {source === 'chinese_sites' && (
          <TextField name="delivery.supplierAddress" label={label('supplierAddress')} />
        )}
      </FormSection>
      <FormSection title={t('portal.request.sections.delivery')}>
        <PlaceField
          name="delivery.country"
          label={label('deliveryCountry', true)}
          required
          options={countries.options}
          loading={countries.loading}
          otherLabel={t('portal.request.fields.countryName')}
        />
        {country?.isOther ? (
          <TextField name="delivery.city.other" label={label('cityName', true)} required />
        ) : (
          <PlaceField
            name="delivery.city"
            label={label('city', true)}
            required
            options={cities.options}
            loading={cities.loading}
            otherLabel={t('portal.request.fields.cityName')}
          />
        )}
        <Full>
          <TextField
            name="delivery.address"
            label={label('deliveryAddress', true)}
            required
            hint={t('portal.request.addressHint')}
          />
        </Full>
        <TextField
          name="delivery.receiverName"
          label={label('receiverName', true)}
          required
          maxLength={80}
        />
        <PhoneField
          name="delivery.receiverPhone"
          label={label('receiverPhone', true)}
          required
          defaultCountry={country?.isOther ? undefined : country?.id}
        />
      </FormSection>
    </div>
  );
}
