import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { LEGAL_FIELDS, formatLegalNumber, legalRule } from '@mirhalgo/shared';
import { Input } from '../../../components/ui';
import type { CompanyFormValues } from '../model';
import { legalCopyCountry } from '../options';
import { DocumentField } from './DocumentField';
import { FormSection } from '../../../components/FormSection';

type LegalField = keyof typeof LEGAL_FIELDS;

/** A legal number: label, hint, keyboard and input mask follow the company country (MW_003 A2). */
function LegalNumberInput({ name }: { name: LegalField }) {
  const { t } = useTranslation();
  const { control, watch } = useFormContext<CompanyFormValues>();
  const country = watch('country');
  const copy = `company.register.fields.legal.${legalCopyCountry(country)}.${LEGAL_FIELDS[name]}`;
  const digits = legalRule(country, name)?.kind !== 'alphanumeric';
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Input
          label={t(copy)}
          hint={t(`${copy}Hint`)}
          inputMode={digits ? 'numeric' : 'text'}
          autoCapitalize={digits ? undefined : 'characters'}
          autoComplete="off"
          dir="ltr"
          placeholder={country === 'EG' && name === 'taxNumber' ? 'XXX-XXX-XXX' : undefined}
          required
          error={fieldState.error?.message}
          {...field}
          onChange={(event) => field.onChange(formatLegalNumber(country, name, event.target.value))}
        />
      )}
    />
  );
}

/** Step 3: legal numbers + documents (spec A2; rules and names per country, MW_003 A2). */
export function DocumentsStep() {
  const { t } = useTranslation();
  const { watch } = useFormContext<CompanyFormValues>();
  const f = (key: string) => t(`company.register.fields.${key}`);
  const activities = watch('activities') ?? [];
  const scope = watch('international.scope');
  const offersCustoms = activities.includes('international') && scope !== 'shipping' && !!scope;

  return (
    <div className="flex flex-col gap-8">
      <FormSection title={t('company.register.sections.legal')}>
        <LegalNumberInput name="commercialRegisterNumber" />
        <LegalNumberInput name="taxNumber" />
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
