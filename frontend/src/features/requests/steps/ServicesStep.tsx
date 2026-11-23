import { useTranslation } from 'react-i18next';
import {
  AVAILABLE_DOCUMENTS,
  EXECUTION_DOCUMENTS,
  INCOTERMS,
  ORDER_LIMITS,
} from '@mirhalgo/shared';
import { FormSection, Full } from '../../../components/FormSection';
import {
  ChoiceField,
  MultiChoiceField,
  SelectField,
  SwitchField,
  TextField,
} from '../components/fields';
import { useLabel } from '../formContext';
import { useChoices } from '../options';

/**
 * Step 5 (spec B3 / B4): documents, optional services, Incoterm and notes. Domestic: the
 * documents question is optional and there is no Incoterm.
 */
export function ServicesStep({ domestic = false }: { domestic?: boolean }) {
  const { t } = useTranslation();
  const label = useLabel();
  const choices = useChoices();
  return (
    <div className="flex flex-col gap-8">
      <FormSection
        title={t('portal.request.sections.documentsAvailable')}
        className="sm:grid-cols-1"
      >
        <MultiChoiceField
          name="services.availableDocuments"
          label={label('availableDocuments')}
          options={choices('availableDocuments', AVAILABLE_DOCUMENTS)}
        />
        <ChoiceField
          name="services.executionDocuments"
          label={label('executionDocuments', !domestic)}
          required={!domestic}
          variant="card"
          options={choices('executionDocuments', EXECUTION_DOCUMENTS)}
        />
      </FormSection>
      <FormSection title={t('portal.request.sections.extraServices')}>
        <SwitchField name="services.insurance" label={t('portal.request.fields.insurance')} />
        <SwitchField name="services.warehousing" label={t('portal.request.fields.warehousing')} />
        {!domestic && (
          <SelectField
            name="services.incoterm"
            label={label('incoterm')}
            placeholder={t('portal.request.choose')}
            options={INCOTERMS.map((term) => ({
              value: term,
              label: `${term} · ${t(`portal.request.options.incoterm.${term}`)}`,
            }))}
          />
        )}
        <Full>
          <TextField
            name="notes"
            label={label('notes')}
            multiline
            maxLength={ORDER_LIMITS.notesMax}
          />
        </Full>
      </FormSection>
    </div>
  );
}
