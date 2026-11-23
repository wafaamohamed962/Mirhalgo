import { useForm, type FieldValues, type UseFormProps } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

/**
 * React Hook Form wired to a shared Zod schema (same schema the API uses).
 * Validates on blur first, then on every change once a field was touched.
 */
export function useZodForm<TInput extends FieldValues, TOutput>(
  schema: z.ZodType<TOutput, z.ZodTypeDef, TInput>,
  options?: Omit<UseFormProps<TInput, unknown, TOutput>, 'resolver'>,
) {
  return useForm<TInput, unknown, TOutput>({
    mode: 'onTouched',
    resolver: zodResolver(schema),
    ...options,
  });
}

/**
 * "The form has data": at least one field differs from its default value.
 *
 * Use this instead of `formState.isDirty` for leave guards and Save buttons. Under React
 * StrictMode (development) the form-level `isDirty` turned true right after mount while no field
 * had changed, so "Back to home" asked to confirm on an empty form (MW_003 A3). The per-field
 * `dirtyFields` stay correct. Pass `formState.dirtyFields` (reading it subscribes the component).
 */
export function hasChanges(dirtyFields: unknown): boolean {
  if (dirtyFields === true) return true;
  if (!dirtyFields || typeof dirtyFields !== 'object') return false;
  return Object.values(dirtyFields).some(hasChanges);
}
