import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { COMPANY_LIMITS } from '@mirhalgo/shared';
import { CheckboxGroup, Input, RadioGroup, Switch } from '../../../components/ui';
import { regionOptions, useRegions } from '../../../services/api/reference';
import type { CompanyFormValues } from '../model';
import { regionKind, useCompanyOptions } from '../options';
import { FormSection, Full } from '../../../components/FormSection';
import { LoadError } from './LoadError';

/** Step 2: only the sections of the activities selected in Step 1 (spec A2). */
export function ServicesStep() {
  const { t, i18n } = useTranslation();
  const options = useCompanyOptions();
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<CompanyFormValues>();
  const f = (key: string) => t(`company.register.fields.${key}`);
  const activities = watch('activities') ?? [];
  const country = watch('country');
  const kind = regionKind(country);
  const allRegions = watch('domestic.allRegions');
  // domestic coverage = the regions of the company country (MW_003 A2)
  const regions = useRegions(activities.includes('domestic') ? country : undefined);
  const vehicleTypes = watch('domestic.vehicleTypes') ?? [];
  const sites = watch('china.sites') ?? [];

  return (
    <div className="flex flex-col gap-8">
      {activities.includes('international') && (
        <FormSection
          title={t('company.register.sections.international')}
          className="sm:grid-cols-1"
        >
          <Controller
            control={control}
            name="international.modes"
            render={({ field }) => (
              <CheckboxGroup
                legend={f('modes')}
                options={options.modes}
                required
                value={field.value}
                onChange={field.onChange}
                error={errors.international?.modes?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="international.scope"
            render={({ field }) => (
              <RadioGroup
                legend={f('scope')}
                options={options.scopes}
                required
                value={field.value}
                onChange={field.onChange}
                error={errors.international?.scope?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="international.countries"
            render={({ field }) => (
              <CheckboxGroup
                legend={f('countries')}
                hint={f('servedHint')}
                options={options.countries.filter((option) => option.value !== country)}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="international.regions"
            render={({ field }) => (
              <CheckboxGroup
                legend={f('regions')}
                hint={f('servedHint')}
                options={options.regions}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </FormSection>
      )}

      {activities.includes('domestic') && (
        <FormSection title={t('company.register.sections.domestic')}>
          <Full>
            <Switch
              label={t(`company.register.fields.coverageAll.${kind}`)}
              {...register('domestic.allRegions')}
            />
          </Full>
          {!allRegions && (
            <Full>
              <Controller
                control={control}
                name="domestic.regions"
                render={({ field }) => (
                  <CheckboxGroup
                    legend={t(`company.register.fields.coverageList.${kind}`)}
                    hint={regions.isPending ? t('common.loading') : undefined}
                    options={regionOptions(regions.data ?? [], i18n.language)}
                    required
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.domestic?.regions?.message}
                  />
                )}
              />
              {regions.isError && <LoadError onRetry={() => void regions.refetch()} />}
            </Full>
          )}
          <Full>
            <Controller
              control={control}
              name="domestic.vehicleTypes"
              render={({ field }) => (
                <CheckboxGroup
                  legend={f('vehicleTypes')}
                  options={options.vehicles}
                  required
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.domestic?.vehicleTypes?.message}
                />
              )}
            />
          </Full>
          {vehicleTypes.includes('other') && (
            <Input
              label={f('vehicleTypeOther')}
              maxLength={COMPANY_LIMITS.otherOption.max}
              required
              error={errors.domestic?.vehicleTypeOther?.message}
              {...register('domestic.vehicleTypeOther')}
            />
          )}
          <Input
            label={f('fleetSize')}
            type="number"
            inputMode="numeric"
            min={COMPANY_LIMITS.fleetSize.min}
            max={COMPANY_LIMITS.fleetSize.max}
            error={errors.domestic?.fleetSize?.message}
            {...register('domestic.fleetSize')}
          />
        </FormSection>
      )}

      {activities.includes('china') && (
        <FormSection title={t('company.register.sections.china')}>
          <Full>
            <Controller
              control={control}
              name="china.sites"
              render={({ field }) => (
                <CheckboxGroup
                  legend={f('sites')}
                  options={options.chinaSites}
                  required
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.china?.sites?.message}
                />
              )}
            />
          </Full>
          {sites.includes('other') && (
            <Input
              label={f('siteOther')}
              maxLength={COMPANY_LIMITS.otherOption.max}
              required
              error={errors.china?.siteOther?.message}
              {...register('china.siteOther')}
            />
          )}
          <Full>
            <Controller
              control={control}
              name="china.services"
              render={({ field }) => (
                <CheckboxGroup
                  legend={f('chinaServices')}
                  options={options.chinaServices}
                  required
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.china?.services?.message}
                />
              )}
            />
          </Full>
        </FormSection>
      )}

      <FormSection title={t('company.register.sections.general')}>
        <Input
          label={f('yearsInBusiness')}
          type="number"
          inputMode="numeric"
          min={COMPANY_LIMITS.yearsInBusiness.min}
          max={COMPANY_LIMITS.yearsInBusiness.max}
          error={errors.yearsInBusiness?.message}
          {...register('yearsInBusiness')}
        />
      </FormSection>
    </div>
  );
}
