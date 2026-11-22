import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { COMPANY_LIMITS, formatTaxNumber, toAsciiDigits } from '@mirhalgo/shared';
import { Input } from '../../../components/ui';
import type { CompanyFormValues } from '../model';
import { DocumentField } from './DocumentField';
import { FormSection } from './FormSection';

/** Step 3: legal numbers + documents (spec A2). */
export function DocumentsStep() {
  const { t } = useTranslation();
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<CompanyFormValues>();
  const f = (key: string) => t(`company.register.fields.${key}`);
  const activities = watch('activities') ?? [];
  const scope = watch('international.scope');
  const offersCustoms = activities.includes('international') && scope !== 'shipping' && !!scope;

  return (
    <div className="flex flex-col gap-8">
      <FormSection title={t('company.register.sections.legal')}>
        <Input
          label={f('commercialRegisterNumber')}
          inputMode="numeric"
          dir="ltr"
          maxLength={COMPANY_LIMITS.commercialRegisterDigits.max}
          required
          error={errors.commercialRegisterNumber?.message}
          {...register('commercialRegisterNumber')}
        />
        <Controller
          control={control}
          name="taxNumber"
          render={({ field }) => (
            <Input
              label={f('taxNumber')}
              hint={f('taxNumberHint')}
              inputMode="numeric"
              dir="ltr"
              placeholder="XXX-XXX-XXX"
              required
              error={errors.taxNumber?.message}
              {...field}
              onChange={(event) =>
                field.onChange(formatTaxNumber(toAsciiDigits(event.target.value)))
              }
            />
          )}
        />
      </FormSection>

      <FormSection title={t('company.register.sections.documents')}>
        <DocumentField type="commercial_register" />
        <DocumentField type="tax_card" />
        <DocumentField
          type="customs_license"
          hint={offersCustoms ? f('customsRecommended') : undefined}
        />
        <DocumentField type="logo" />
      </FormSection>
    </div>
  );
}
