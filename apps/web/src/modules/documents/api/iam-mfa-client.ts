import type {
  IamMfaSetupBeginInputV1,
  IamMfaSetupBeginResponseV1,
  IamMfaSetupConfirmInputV1,
  IamMfaSetupConfirmResponseV1,
  IamMfaStatusResponseV1,
} from '@rubi/contracts';

import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';

export class IamMfaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  retriedAfterRefresh = false,
): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new IamMfaApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await fetch(`${baseUrl}/iam/auth/mfa${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (
    response.status === 401 &&
    !retriedAfterRefresh &&
    (await refreshAuthenticatedSession(baseUrl))
  )
    return request<T>(path, init, true);
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
      error?: { code?: string; message?: string };
    } | null;
    throw new IamMfaApiError(
      envelope?.error?.message ??
        envelope?.message ??
        'اعتبارسنجی دومرحله‌ای ناموفق بود.',
      response.status,
      envelope?.error?.code ?? envelope?.code,
    );
  }
  return response.json() as Promise<T>;
}

export const iamMfaApi = {
  status() {
    return request<IamMfaStatusResponseV1>('/status');
  },
  begin(input: IamMfaSetupBeginInputV1) {
    return request<IamMfaSetupBeginResponseV1>('/setup', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  confirm(input: IamMfaSetupConfirmInputV1) {
    return request<IamMfaSetupConfirmResponseV1>('/confirm', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
