import { createContext, useContext } from 'react';
import { get, useFormContext, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ServiceType, UploadedFile } from '@mirhalgo/shared';

/** Shared by the fields of one form: the service and the metadata of uploaded files. */
export const RequestFormContext = createContext<{
  service: ServiceType;
  uploads: Record<string, UploadedFile>;
  rememberUploads: (files: UploadedFile[]) => void;
} | null>(null);
export const useRequestForm = () => {
  const value = useContext(RequestFormContext);
  if (!value) throw new Error('RequestFormContext missing');
  return value;
};

export function useFieldError(name: string): string | undefined {
  const {
    formState: { errors },
  } = useFormContext<FieldValues>();
  return (get(errors, name) as { message?: string } | undefined)?.message;
}

/** "Full name" / "Notes (optional)": the label key under portal.request.fields. */
export function useLabel() {
  const { t } = useTranslation();
  return (key: string, required = false) =>
    required
      ? t(`portal.request.fields.${key}`)
      : `${t(`portal.request.fields.${key}`)} ${t('portal.request.optional')}`;
}
