import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
export async function downloadContractResponse(
  id: string,
  send: typeof fetch = fetch,
  refresh = refreshAuthenticatedSession,
  base = getPublicApiBaseUrl(),
) {
  const request = () =>
    send('/sales/contracts/' + encodeURIComponent(id) + '/pdf', {
      credentials: 'include',
      cache: 'no-store',
    });
  let response = await request();
  if (response.status === 401 && base && (await refresh(base)))
    response = await request();
  return response;
}
