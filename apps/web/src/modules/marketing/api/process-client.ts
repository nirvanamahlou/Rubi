import type { MarketingProcessResponseV1 } from '@nora/contracts';

import { getPublicApiBaseUrl } from '@/lib/environment';

export class MarketingProcessApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function fetchMarketingProcess(
  signal?: AbortSignal,
): Promise<MarketingProcessResponseV1> {
  const base = getPublicApiBaseUrl();
  if (!base)
    throw new MarketingProcessApiError('نشانی API پیکربندی نشده است.', 0);

  const response = await fetch(`${base}/marketing/process`, {
    credentials: 'include',
    headers: { accept: 'application/json' },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      error?: { message?: string };
    } | null;
    throw new MarketingProcessApiError(
      body?.error?.message ??
        body?.message ??
        'دریافت وضعیت فرایند مارکتینگ ناموفق بود.',
      response.status,
    );
  }
  return response.json() as Promise<MarketingProcessResponseV1>;
}
