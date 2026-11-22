import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { COMPANY_LIMITS } from '@mirhalgo/shared';
import {
  CheckboxGroup,
  Input,
  PasswordInput,
  PhoneInput,
  Select,
  Switch,
} from '../../../components/ui';
import type { CompanyFormValues } from '../model';
import { useCompanyOptions } from '../options';
import { FormSection, Full } from './FormSection';

/** Step 1: account & company information (spec A2). */
export function AccountStep() {
  const { t } = useTranslation();
  const options = useCompanyOptions();
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<CompanyFormValues>();
  const f = (key: string) => t(`company.register.fields.${key}`);
  const sameWhatsapp = watch('whatsappSameAsMobile');
  const activities = watch('activities') ?? [];

  return (
    <div className="flex flex-col gap-8">
      <FormSection title={t('company.register.sections.company')}>
        <Full>
          <Input
            label={f('legalName')}
            autoComplete="organization"
            maxLength={COMPANY_LIMITS.legalName.max}
            required
            error={errors.legalName?.message}
            {...register('legalName')}
          />
        </Full>
        <Input
          label={f('representativeName')}
          autoComplete="name"
          required
          error={errors.representativeName?.message}
          {...register('representativeName')}
        />
        <Input
          label={f('representativeTitle')}
          hint={f('representativeTitleHint')}
          autoComplete="organization-title"
          required
          error={errors.representativeTitle?.message}
          {...register('representativeTitle')}
        />
      </FormSection>

      <FormSection title={t('company.register.sections.contact')}>
        <Input
          label={f('email')}
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
            <PhoneInput label={f('phone')} required error={errors.phone?.message} {...field} />
          )}
        />
        <Full>
          <Switch label={f('whatsappSame')} {...register('whatsappSameAsMobile')} />
        </Full>
        {!sameWhatsapp && (
          <Controller
            control={control}
            name="whatsapp"
            render={({ field }) => (
              <PhoneInput label={f('whatsapp')} error={errors.whatsapp?.message} {...field} />
            )}
          />
        )}
        <Input
          label={f('landline')}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          dir="ltr"
          error={errors.landline?.message}
          {...register('landline')}
        />
        <Full>
          <Input
            label={f('website')}
            hint={f('websiteHint')}
            type="url"
            inputMode="url"
            autoComplete="url"
            dir="ltr"
            error={errors.website?.message}
            {...register('website')}
          />
        </Full>
      </FormSection>

      <FormSection title={t('company.register.sections.address')}>
        <Select
          label={f('governorate')}
          placeholder={f('governoratePlaceholder')}
          options={options.governorates.map((o) => ({ value: o.value, label: String(o.label) }))}
          required
          error={errors.governorate?.message}
          {...register('governorate')}
        />
        <Input
          label={f('city')}
          autoComplete="address-level2"
          required
          error={errors.city?.message}
          {...register('city')}
        />
        <Full>
          <Input
            label={f('street')}
            autoComplete="street-address"
            required
            error={errors.street?.message}
            {...register('street')}
          />
        </Full>
      </FormSection>

      <FormSection title={t('company.register.sections.account')}>
        <PasswordInput
          label={f('password')}
          autoComplete="new-password"
          showStrength
          required
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordInput
          label={f('confirmPassword')}
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
      </FormSection>

      <FormSection title={t('company.register.sections.activities')} className="sm:grid-cols-1">
        <Controller
          control={control}
          name="activities"
          render={({ field }) => (
            <CheckboxGroup
              legend={f('activities')}
              variant="card"
              options={options.activities}
              required
              value={field.value}
              onChange={field.onChange}
              error={errors.activities?.message}
            />
          )}
        />
        {activities.includes('other') && (
          <Input
            label={f('otherActivity')}
            maxLength={COMPANY_LIMITS.otherActivity.max}
            required
            error={errors.otherActivity?.message}
            {...register('otherActivity')}
          />
        )}
      </FormSection>
    </div>
  );
}
