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
