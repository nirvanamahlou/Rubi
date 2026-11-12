import type { ReservationIntakeV1 } from '@nora/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import type { PurchaseCategory, PurchaseFilters } from './model';
export interface PurchaseServiceRow {
  id: string;
  clientKey: string;
  coveredServiceClientKeys?: string[];
  status: 'REGISTERED' | 'UNREGISTERED' | 'UNKNOWN';
  entryAt: string;
  departureAt: string | null;
  checkInAt: string | null;
  purchasedAt: string | null;
  sortAt: string | null;
}
export interface PurchaseInbox {
  data: ReservationIntakeV1[];
  meta: {
    page: number;
    pageSize: number;
    hasMore: boolean;
    canRecord: boolean;
    services?: PurchaseServiceRow[];
    summary?: {
      total: number;
      registered: number;
      unregistered: number;
      unknown: number;
      contracts: number;
    };
  };
}
export async function loadPurchaseInbox(
  kind: PurchaseCategory,
  page: number,
  contractNumber: string,
  signal: AbortSignal,
  filters: PurchaseFilters,
): Promise<PurchaseInbox> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی سرور پیکربندی نشده است.');
  const response = await authenticatedFetch(
    `${base}/reservations/requests/purchases?${new URLSearchParams({ kind: kind === 'FLOATING' ? 'FLIGHT' : kind, page: String(page), contractNumber, ...filters })}`,
    base,
    { signal, timeoutMs: null },
  );
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      result?.error?.message ??
        result?.message ??
        'دریافت خریدهای رزرواسیون ناموفق بود.',
    );
  return result;
}
