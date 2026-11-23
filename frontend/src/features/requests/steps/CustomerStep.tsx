import { useFormContext, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import {
  CLIENT_TYPES,
  NAMED_CLIENT_TYPES,
  SHIPPING_CLIENT_TYPES,
  type ServiceType,
} from '@mirhalgo/shared';
import { FormSection, Full } from '../../../components/FormSection';
import { ChoiceField, PhoneField, SwitchField, TextField } from '../components/fields';
import { useLabel } from '../formContext';
import { useChoices } from '../options';

/** Step 1 of every form (spec B3 / B5): prefilled from the profile, editable for this request. */
export function CustomerStep({ service }: { service: ServiceType }) {
  const { t } = useTranslation();
  const label = useLabel();
  const choices = useChoices();
  const { watch } = useFormContext<FieldValues>();
  const sameWhatsapp = watch('contact.whatsappSameAsPhone') !== false;
  const clientType: string | undefined = watch('contact.clientType');
  const types = service === 'china' ? CLIENT_TYPES : SHIPPING_CLIENT_TYPES;

  return (
    <div className="flex flex-col gap-8">
      <FormSection title={t('portal.request.sections.contact')}>
        <Full>
          <p className="flex items-start gap-2 text-small text-muted">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {t('portal.request.prefillNote')}
          </p>
        </Full>
        <TextField
          name="contact.fullName"
          label={label('fullName', true)}
          required
          maxLength={80}
        />
        <PhoneField name="contact.phone" label={label('phone', true)} required />
        <Full>
          <SwitchField
            name="contact.whatsappSameAsPhone"
            label={t('portal.request.fields.whatsappSameAsPhone')}
          />
        </Full>
        {!sameWhatsapp && (
          <PhoneField name="contact.whatsapp" label={label('whatsapp', true)} required />
        )}
      </FormSection>

      <FormSection title={t('portal.request.sections.client')} className="sm:grid-cols-1">
        <ChoiceField
          name="contact.clientType"
          label={label('clientType', true)}
          required
          variant="card"
          options={choices('clientType', types)}
        />
        {clientType && NAMED_CLIENT_TYPES.includes(clientType as never) && (
          <TextField
            name="contact.businessName"
            label={label(`businessName_${clientType}`, true)}
            required
            maxLength={120}
          />
        )}
      </FormSection>
    </div>
  );
}
