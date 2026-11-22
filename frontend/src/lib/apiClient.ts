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

/** Unwraps `{ ok, data }`; anything else becomes an ApiRequestError. */
function unwrap<T>(json: ApiResponse<T> | null, status: number): T {
  if (!json) throw new ApiRequestError('INTERNAL', 'Invalid server response', status);
  if (!json.ok) throw new ApiRequestError(json.error.code, json.error.message, status);
  return json.data;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** The logged-in user's access token (supabase-js is loaded lazily, see AuthProvider). */
async function accessToken(): Promise<string | null> {
  const { supabase } = await import('./supabase');
  return (await supabase.auth.getSession()).data.session?.access_token ?? null;
}

/**
 * Typed fetch wrapper: unwraps `{ ok, data }` and maps failures to ApiRequestError.
 * `auth` sends the session as a Bearer token (customer portal endpoints).
 */
export async function apiRequest<T>(
  method: Method,
  path: `/${string}`,
  {
    body,
    auth = false,
    headers: extraHeaders = {},
  }: { body?: unknown; auth?: boolean; headers?: Record<string, string> } = {},
): Promise<T> {
  assertConfigured(missingApiEnv);
  const headers: Record<string, string> = { ...extraHeaders };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = await accessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError('NETWORK_ERROR', 'Network error', 0);
  }

  const json = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  return unwrap(json, response.status);
}

/** Public JSON POST (auth flows, contact form). */
export const apiPost = <T>(path: `/${string}`, body: unknown) =>
  apiRequest<T>('POST', path, { body });

/**
 * multipart/form-data POST with upload progress (0–100). Uses XMLHttpRequest because
 * fetch cannot report upload progress. `auth` sends the session (order attachments, MW_003 B3).
 */
export async function apiUpload<T>(
  path: `/${string}`,
  body: FormData,
  onProgress?: (percent: number) => void,
  { auth = false }: { auth?: boolean } = {},
): Promise<T> {
  assertConfigured(missingApiEnv);
  const token = auth ? await accessToken() : null;

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${env.apiUrl}/api${path}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.((event.loaded / event.total) * 100);
    };
    xhr.onerror = () => reject(new ApiRequestError('NETWORK_ERROR', 'Network error', 0));
    xhr.onload = () => {
      try {
        resolve(unwrap(xhr.response as ApiResponse<T> | null, xhr.status));
      } catch (error) {
        reject(error);
      }
    };
    xhr.send(body);
  });
}

/** i18n key for any error thrown by an API call (or by missing configuration). */
export function errorKey(error: unknown): `errors.${ErrorCode}` {
  if (error instanceof ConfigError) return 'errors.CONFIG_MISSING';
  return `errors.${error instanceof ApiRequestError ? error.code : 'INTERNAL'}`;
}
