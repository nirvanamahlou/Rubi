import type { ReservationIntakeV1 } from '@nora/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { localizedFetch } from '@/i18n/localized-fetch';
import type { PurchaseCategory } from './model';
export interface PurchaseInbox {
  data: ReservationIntakeV1[];
  meta: {
    page: number;
    pageSize: number;
    hasMore: boolean;
    canRecord: boolean;
  };
}
export async function loadPurchaseInbox(
  kind: PurchaseCategory,
  page: number,
  contractNumber: string,
  signal: AbortSignal,
): Promise<PurchaseInbox> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی سرور پیکربندی نشده است.');
  const get = () =>
    localizedFetch(
      `${base}/reservations/requests/purchases?${new URLSearchParams({ kind, page: String(page), contractNumber })}`,
      { credentials: 'include', cache: 'no-store', signal },
    );
  let response = await get();
  if (response.status === 401 && (await refreshAuthenticatedSession(base)))
    response = await get();
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      result?.error?.message ??
        result?.message ??
        'دریافت خریدهای رزرواسیون ناموفق بود.',
    );
  return result;
}
