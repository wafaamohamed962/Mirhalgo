import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FILE_RULES, type DocumentType } from '@mirhalgo/shared';
import { FileUpload } from '../../../components/ui';
import { checkPickedFile } from '../api';
import type { CompanyFormValues } from '../model';

const ImageCropper = lazy(() => import('../../../components/ImageCropper'));

/**
 * One document upload: checks the picked file at once (same rules as the server, real
 * type from its first bytes), and lets the user crop the logo to a square.
 */
export function DocumentField({ type, hint }: { type: DocumentType; hint?: ReactNode }) {
  const { t } = useTranslation();
  const { control, setValue, clearErrors, formState } = useFormContext<CompanyFormValues>();
  const [pickError, setPickError] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [toCrop, setToCrop] = useState<File | null>(null);
  const rule = FILE_RULES[type];
  const name = `files.${type}` as const;

  const accept = (file: File | null) => {
    setValue(name, file, { shouldDirty: true, shouldValidate: formState.isSubmitted });
    clearErrors(name);
  };

  const onSelect = async (file: File) => {
    setChecking(true);
    const error = await checkPickedFile(file, type).catch(() => rule.typeError);
    setChecking(false);
    setPickError(error ?? undefined);
    if (error) return;
    if (type === 'logo') setToCrop(file);
    else accept(file);
  };

  return (
    <>
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <FileUpload
            label={t(`options.document.${type}`)}
            accept={rule.mimes.join(',')}
            hint={
              <>
                {t(`company.register.files.${type === 'logo' ? 'logoHint' : 'documentHint'}`)}
                {hint && <span className="block">{hint}</span>}
              </>
            }
            value={field.value ?? null}
            onSelect={onSelect}
            onRemove={() => {
              setPickError(undefined);
              accept(null);
            }}
            error={pickError ?? fieldState.error?.message}
            required={rule.required}
            busy={checking}
          />
        )}
      />
      {toCrop && (
        <Suspense fallback={null}>
          <ImageCropper
            file={toCrop}
            title={t('ui.crop.logoTitle')}
            onCancel={() => setToCrop(null)}
            onDone={(cropped) => {
              setToCrop(null);
              accept(cropped);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
