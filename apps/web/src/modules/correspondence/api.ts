import { localizedFetch } from '@/i18n/localized-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';

export async function issueLetterNumber(
  companyId: string,
  date: string,
  idempotencyKey: string,
  retried = false,
): Promise<{ number: string; date: string }> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new Error('نشانی API پیکربندی نشده است.');
  const response = await localizedFetch(
    `${baseUrl}/correspondence/v1/numbers`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, date, idempotencyKey }),
    },
  );
  if (
    response.status === 401 &&
    !retried &&
    (await refreshAuthenticatedSession(baseUrl))
  )
    return issueLetterNumber(companyId, date, idempotencyKey, true);
  const result = (await response.json().catch(() => null)) as {
    number?: string;
    date?: string;
    message?: string;
    error?: { message?: string };
  } | null;
  if (!response.ok || !result?.number || !result.date)
    throw new Error(
      result?.error?.message ||
        result?.message ||
        'شماره‌گذاری نامه ناموفق بود.',
    );
  return { number: result.number, date: result.date };
}
