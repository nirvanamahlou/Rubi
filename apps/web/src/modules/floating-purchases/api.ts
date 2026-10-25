import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
export async function floatingRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('ارتباط برقرار نشد؛ دوباره تلاش کنید.');
  const send = () =>
    fetch(`${base}/floating-purchases${path}`, {
      ...init,
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  let response = await send();
  if (
    response.status === 401 &&
    (await refreshAuthenticatedSession(base ?? ''))
  )
    response = await send();
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      body?.error?.message ??
        body?.message ??
        'دریافت خریدهای رزرواسیون ناموفق بود.',
    );
  return body as T;
}
