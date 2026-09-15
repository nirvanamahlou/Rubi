'use client';

import type {
  TicketCatalogPurchaseCreateV1,
  TicketCatalogPurchaseV1,
} from '@nora/contracts';

import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
import type { Product } from '../model/catalog';

export async function registerTicketPurchase(
  product: Product,
): Promise<TicketCatalogPurchaseV1> {
  const serviceDate =
    product.definition.serviceDate ||
    product.definition.segments[0]?.departureAt.slice(0, 10) ||
    null;
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new Error('نشانی API سامانه تنظیم نشده است.');
  const session = await refreshAuthenticatedSession(baseUrl);
  const branchId = session?.user.branches[0]?.id;
  if (!branchId) throw new Error('شعبه مجاز برای ثبت قیمت خرید یافت نشد.');
  const input: TicketCatalogPurchaseCreateV1 = {
    version: 1,
    catalogProductReference: product.id,
    title: product.definition.title,
    serviceDate,
    supplierDisplaySnapshot: product.definition.display?.operator ?? null,
    amount: null,
    currencyCode: null,
  };
  const response = await fetch(baseUrl + '/procurement/ticket-purchases', {
    method: 'POST',
    credentials: 'include',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-branch-id': branchId,
      'idempotency-key':
        'ticket-purchase:' + product.id + ':v' + product.version,
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(
      payload?.message ||
        'ثبت درخواست قیمت خرید بلیط در کارتابل مالی ناموفق بود.',
    );
  }
  return response.json() as Promise<TicketCatalogPurchaseV1>;
}
