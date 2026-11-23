import type { ReactNode } from 'react';
import { Controller, useFormContext, type FieldValues, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  CURRENCIES,
  WEIGHT_UNITS,
  type OrderUploadPurpose,
  type UploadedFile,
} from '@mirhalgo/shared';
import {
  CheckboxGroup,
  Input,
  PhoneInput,
  RadioGroup,
  Select,
  Switch,
  Textarea,
  type ChoiceOption,
} from '../../../components/ui';
import { COMBOBOX_OTHER, Combobox, type ComboboxOption } from '../../../components/ui/Combobox';
import { useFieldError, useLabel, useRequestForm } from '../formContext';
import { AttachmentField } from './AttachmentField';

/*
 * Form fields of the New Request forms (MW_003 B5). Each one reads its error from the form
 * (schema issues are set on the field with the same path), marks required fields with "*" and
 * optional ones with "(optional)" (spec B2), and uses the UI kit.
 */

type Base = { name: string; label: ReactNode; required?: boolean; hint?: ReactNode };

export function TextField({
  name,
  label,
  required,
  hint,
  multiline = false,
  dir,
  inputMode,
  maxLength,
  type,
  min,
}: Base & {
  multiline?: boolean;
  dir?: 'ltr' | 'rtl' | 'auto';
  inputMode?: 'text' | 'numeric' | 'decimal' | 'url';
  maxLength?: number;
  type?: 'text' | 'date' | 'url';
  min?: string;
}) {
  const { register } = useFormContext<FieldValues>();
  const error = useFieldError(name);
  const field = register(name as Path<FieldValues>);
  return multiline ? (
    <Textarea
      label={label}
      required={required}
      hint={hint}
      error={error}
      rows={4}
      maxLength={maxLength}
      {...field}
    />
  ) : (
    <Input
      label={label}
      required={required}
      hint={hint}
      error={error}
      dir={dir}
      inputMode={inputMode}
      maxLength={maxLength}
      type={type ?? 'text'}
      min={min}
      {...field}
    />
  );
}

/** Numbers are typed as text: Arabic / Persian digits are accepted (the schema converts them). */
export const NumberField = (props: Base & { decimal?: boolean }) => (
  <TextField {...props} dir="ltr" inputMode={props.decimal ? 'decimal' : 'numeric'} />
);

export function ChoiceField<V extends string>({
  name,
  label,
  options,
  required,
  hint,
  variant = 'chip',
}: Base & { options: ReadonlyArray<ChoiceOption<V>>; variant?: 'chip' | 'card' }) {
  const { control } = useFormContext<FieldValues>();
  const error = useFieldError(name);
  return (
    <Controller
      control={control}
      name={name as Path<FieldValues>}
      render={({ field }) => (
        <RadioGroup
          legend={label}
          options={options}
          variant={variant}
          required={required}
          hint={hint}
          value={field.value}
          onChange={field.onChange}
          error={error}
          name={name}
        />
      )}
    />
  );
}

export function MultiChoiceField<V extends string>({
  name,
  label,
  options,
  required,
  hint,
}: Base & { options: ReadonlyArray<ChoiceOption<V>> }) {
  const { control } = useFormContext<FieldValues>();
  const error = useFieldError(name);
  return (
    <Controller
      control={control}
      name={name as Path<FieldValues>}
      render={({ field }) => (
        <CheckboxGroup
          legend={label}
          options={options}
          required={required}
          hint={hint}
          value={field.value ?? []}
          onChange={field.onChange}
          error={error}
          name={name}
        />
      )}
    />
  );
}

/** Yes / No, stored as 'yes' | 'no' (the order gets a boolean). */
export function YesNoField(props: Base) {
  const { t } = useTranslation();
  return (
    <ChoiceField
      {...props}
      options={[
        { value: 'yes', label: t('portal.request.yes') },
        { value: 'no', label: t('portal.request.no') },
      ]}
    />
  );
}

export function SwitchField({ name, label }: { name: string; label: ReactNode }) {
  const { register } = useFormContext<FieldValues>();
  return <Switch label={label} {...register(name as Path<FieldValues>)} />;
}

export function SelectField({
  name,
  label,
  options,
  required,
  placeholder,
}: Base & { options: ReadonlyArray<{ value: string; label: string }>; placeholder?: string }) {
  const { register } = useFormContext<FieldValues>();
  const error = useFieldError(name);
  return (
    <Select
      label={label}
      options={options}
      placeholder={placeholder}
      required={required}
      error={error}
      {...register(name as Path<FieldValues>)}
    />
  );
}

/** A reference-list id (no "Other"), e.g. container type, governorate, Egyptian port. */
export function CodeField({
  name,
  label,
  options,
  required,
  loading,
  hint,
}: Base & { options: readonly ComboboxOption[]; loading?: boolean }) {
  const { t } = useTranslation();
  const { control } = useFormContext<FieldValues>();
  const error = useFieldError(name);
  return (
    <Controller
      control={control}
      name={name as Path<FieldValues>}
      render={({ field }) => (
        <Combobox
          ref={field.ref}
          label={label}
          options={options}
          loading={loading}
          required={required}
          hint={hint}
          placeholder={t('portal.request.search')}
          value={field.value ?? null}
          onChange={(value) => field.onChange(value ?? '')}
          onBlur={field.onBlur}
          error={error}
        />
      )}
    />
  );
}

const ANY = '__any__';

/**
 * A list choice or "Other" with a typed value, stored as { id } / { isOther, other }
 * (spec B2: the manual value is kept apart from the list id). `anyLabel` adds "Any airport".
 */
export function PlaceField({
  name,
  label,
  options,
  required,
  loading,
  anyLabel,
  otherLabel,
}: Base & {
  options: readonly ComboboxOption[];
  loading?: boolean;
  anyLabel?: string;
  otherLabel?: string;
}) {
  const { t } = useTranslation();
  const { control, watch, setValue } = useFormContext<FieldValues>();
  const error = useFieldError(name);
  const otherError = useFieldError(`${name}.other`);
  const current = (watch(name as Path<FieldValues>) ?? {}) as {
    id?: string;
    isOther?: boolean;
    any?: boolean;
  };
  const all = anyLabel ? [{ value: ANY, label: anyLabel }, ...options] : options;
  return (
    <div className="flex flex-col gap-3">
      <Controller
        control={control}
        name={`${name}.id` as Path<FieldValues>}
        render={({ field }) => (
          <Combobox
            ref={field.ref}
            label={label}
            options={all}
            loading={loading}
            required={required}
            placeholder={t('portal.request.search')}
            otherLabel={t('portal.request.otherOption')}
            value={current.any ? ANY : current.isOther ? COMBOBOX_OTHER : (current.id ?? null)}
            onChange={(value) =>
              setValue(
                name as Path<FieldValues>,
                value === COMBOBOX_OTHER
                  ? { isOther: true, other: '' }
                  : value === ANY
                    ? { any: true }
                    : { id: value ?? '' },
                { shouldDirty: true },
              )
            }
            onBlur={field.onBlur}
            error={current.isOther ? undefined : error}
          />
        )}
      />
      {current.isOther && (
        <TextField
          name={`${name}.other`}
          label={otherLabel ?? t('portal.request.fields.otherValue')}
          required={required}
        />
      )}
      {current.isOther && error && !otherError && (
        <p className="-mt-2 text-caption text-error">{t(error)}</p>
      )}
    </div>
  );
}

export function PhoneField({
  name,
  label,
  required,
  defaultCountry,
}: Base & { defaultCountry?: string }) {
  const { control } = useFormContext<FieldValues>();
  const error = useFieldError(name);
  return (
    <Controller
      control={control}
      name={name as Path<FieldValues>}
      render={({ field }) => (
        <PhoneInput
          label={label}
          required={required}
          defaultCountry={defaultCountry}
          error={error}
          {...field}
        />
      )}
    />
  );
}

/** Value + unit (KG / TON). */
export function WeightField({ name, label, required }: Base) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-[1fr_7rem] items-start gap-2">
      <NumberField name={`${name}.value`} label={label} required={required} decimal />
      <SelectField
        name={`${name}.unit`}
        label={t('portal.request.fields.unit')}
        options={WEIGHT_UNITS.map((unit) => ({
          value: unit,
          label: t(`portal.request.options.weightUnit.${unit}`),
        }))}
      />
    </div>
  );
}

/** Amount + currency (USD / EUR / EGP). */
export function MoneyField({ name, label, required, hint }: Base) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-[1fr_7rem] items-start gap-2">
      <NumberField name={`${name}.amount`} label={label} required={required} hint={hint} decimal />
      <SelectField
        name={`${name}.currency`}
        label={t('portal.request.fields.currency')}
        placeholder={t('portal.request.choose')}
        options={CURRENCIES.map((c) => ({ value: c, label: c }))}
      />
    </div>
  );
}

/** Length × width × height in cm. */
export function DimensionsField({ name, required }: { name: string; required?: boolean }) {
  const label = useLabel();
  return (
    <div className="grid grid-cols-3 gap-2">
      {(['length', 'width', 'height'] as const).map((side) => (
        <NumberField
          key={side}
          name={`${name}.${side}`}
          label={label(side, required)}
          required={required}
          decimal
        />
      ))}
    </div>
  );
}

/**
 * Upload field bound to the form: keeps the upload id(s) in the form (they go with the draft
 * and the order), the file metadata in the form context.
 */
export function UploadField({
  name,
  label,
  purpose,
  max = 1,
  required,
  hint,
}: Base & { purpose: OrderUploadPurpose; max?: number }) {
  const { uploads, rememberUploads } = useRequestForm();
  const { control } = useFormContext<FieldValues>();
  const error = useFieldError(name);
  return (
    <Controller
      control={control}
      name={name as Path<FieldValues>}
      render={({ field }) => {
        const ids: string[] = max === 1 ? (field.value ? [field.value] : []) : (field.value ?? []);
        const value = ids
          .map((id) => uploads[id])
          .filter((file): file is UploadedFile => Boolean(file));
        return (
          <AttachmentField
            label={label}
            purpose={purpose}
            max={max}
            required={required}
            hint={hint}
            error={error}
            value={value}
            onChange={(files) => {
              rememberUploads(files);
              const next = files.map((f) => f.id);
              field.onChange(max === 1 ? next[0] : next);
            }}
          />
        );
      }}
    />
  );
}
