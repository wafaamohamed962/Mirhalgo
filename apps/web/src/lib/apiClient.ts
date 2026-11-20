import type { ApiResponse, ErrorCode } from '@mirhalgo/shared';
import { assertConfigured, ConfigError, env, missingApiEnv } from './env';

/** Error thrown for every failed API call, carrying the i18n-ready error code. */
export class ApiRequestError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/** Small typed fetch wrapper: unwraps `{ ok, data }` and maps failures to ApiRequestError. */
export async function apiPost<T>(path: `/${string}`, body: unknown): Promise<T> {
  assertConfigured(missingApiEnv);

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError('NETWORK_ERROR', 'Network error', 0);
  }

  const json = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json) throw new ApiRequestError('INTERNAL', 'Invalid server response', response.status);
  if (!json.ok) throw new ApiRequestError(json.error.code, json.error.message, response.status);
  return json.data;
}

/** i18n key for any error thrown by an API call (or by missing configuration). */
export function errorKey(error: unknown): `errors.${ErrorCode}` {
  if (error instanceof ConfigError) return 'errors.CONFIG_MISSING';
  return `errors.${error instanceof ApiRequestError ? error.code : 'INTERNAL'}`;
}
