'use client';

import type { FinanceInboxV1 } from '@rubi/contracts';

import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';

export class FinanceInboxApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request(retried = false): Promise<FinanceInboxV1> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl)
    throw new FinanceInboxApiError('نشانی API کارتابل مالی تنظیم نشده است.', 0);
  const response = await fetch(`${baseUrl}/finance/inbox`, {
    credentials: 'include',
    cache: 'no-store',
    headers: { accept: 'application/json' },
  }).catch(() => {
    throw new FinanceInboxApiError(
      'ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.',
      0,
    );
  });
  if (
    response.status === 401 &&
    !retried &&
    (await refreshAuthenticatedSession(baseUrl))
  )
    return request(true);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
      error?: { message?: string };
    } | null;
    throw new FinanceInboxApiError(
      response.status === 401
        ? 'نشست ورود پایان یافته است؛ دوباره وارد شوید.'
        : response.status === 403
          ? 'برای مشاهده کارتابل مالی مجوز ندارید.'
          : (payload?.error?.message ??
            payload?.message ??
            'دریافت کارتابل مالی ناموفق بود.'),
      response.status,
    );
  }
  return response.json() as Promise<FinanceInboxV1>;
}

export const financeInboxApi = { list: () => request() };
