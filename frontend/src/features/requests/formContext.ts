import { createContext, useContext, useEffect } from 'react';
import { get, useFieldArray, useFormContext, type FieldValues } from 'react-hook-form';
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

/**
 * A repeatable list with at least one row (groups, products, colours: min 1, spec B3 / B5). A
 * list that is hidden and shown again starts with `empty`. The check reads the live form value,
 * not `fields` (one render behind): React StrictMode runs the effect twice, and both runs saw
 * no rows, so two rows were added.
 */
export function useRepeatable(name: string, empty: FieldValues) {
  const { control, getValues } = useFormContext<FieldValues>();
  const array = useFieldArray({ control, name });
  const { append } = array;
  useEffect(() => {
    const rows = getValues(name) as unknown[] | undefined;
    if (!rows?.length) append(empty, { shouldFocus: false });
  }, [append, getValues, name, empty]);
  return array;
}
