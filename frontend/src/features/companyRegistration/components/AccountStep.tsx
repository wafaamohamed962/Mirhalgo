import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { COMPANY_LIMITS, type CompanyCountry } from '@mirhalgo/shared';
import {
  CheckboxGroup,
  Input,
  PasswordInput,
  PhoneInput,
  Select,
  Switch,
} from '../../../components/ui';
import {
  localizedName,
  regionOptions,
  useCountries,
  useRegions,
} from '../../../services/api/reference';
import type { CompanyFormValues } from '../model';
import { regionKind, useCompanyOptions } from '../options';
import { FormSection, Full } from './FormSection';
import { LoadError } from './LoadError';

/**
 * Country → Governorate / Region / Emirate (MW_003 A2): both lists come from the reference API.
 * A country change by the user clears the region and the Step 2 values of the old country.
 */
function CountryRegionFields() {
  const { t, i18n } = useTranslation();
  const {
    control,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<CompanyFormValues>();
  const f = (key: string) => t(`company.register.fields.${key}`);
  const country = watch('country');
  const kind = regionKind(country);
  const countries = useCountries('company_signup');
  const regions = useRegions(country);

  const changeCountry = (next: CompanyCountry) => {
    const edit = { shouldDirty: true } as const;
    setValue('region', '', edit);
    setValue('domestic.regions', [], edit);
    const served = getValues('international.countries') ?? [];
    if (served.includes(next)) {
      setValue(
        'international.countries',
        served.filter((code) => code !== next),
        edit,
      );
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <Controller
          control={control}
          name="country"
          render={({ field }) => (
            <Select
              label={f('country')}
              placeholder={f('countryPlaceholder')}
              options={(countries.data ?? []).map((c) => ({
                value: c.code,
                label: localizedName(c.name, i18n.language),
              }))}
              required
              error={errors.country?.message}
              {...field}
              value={field.value ?? ''}
              onChange={(event) => {
                const next = event.target.value as CompanyCountry;
                field.onChange(next);
                changeCountry(next);
              }}
            />
          )}
        />
        {countries.isError && <LoadError onRetry={() => void countries.refetch()} />}
      </div>
      <div className="flex flex-col gap-2">
        <Controller
          control={control}
          name="region"
          render={({ field }) => (
            <Select
              label={t(`company.register.fields.region.${kind}`)}
              placeholder={
                country ? t(`company.register.fields.regionPlaceholder.${kind}`) : f('regionFirst')
              }
              options={regionOptions(regions.data ?? [], i18n.language)}
              disabled={!country || regions.isPending}
              required
              error={errors.region?.message}
              {...field}
              value={field.value ?? ''}
            />
          )}
        />
        {regions.isError && <LoadError onRetry={() => void regions.refetch()} />}
      </div>
    </>
  );
}

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
  const country = watch('country');
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
            <PhoneInput
              label={f('phone')}
              required
              defaultCountry={country}
              error={errors.phone?.message}
              {...field}
            />
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
              <PhoneInput
                label={f('whatsapp')}
                defaultCountry={country}
                error={errors.whatsapp?.message}
                {...field}
              />
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
        <CountryRegionFields />
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
