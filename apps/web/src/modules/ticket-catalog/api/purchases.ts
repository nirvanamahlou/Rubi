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
): Promise<TicketCatalogPurchaseV1 | null> {
  const amount = product.definition.fare.purchase;
  if (!amount || /^0(?:\.0+)?$/.test(amount)) return null;
  const serviceDate =
    product.definition.serviceDate ||
    product.definition.segments[0]?.departureAt.slice(0, 10) ||
    '';
  if (!serviceDate)
    throw new Error('برای ارسال قیمت خرید به مالی، تاریخ اولین بلیط لازم است.');
  const currencyCode = product.definition.fare.currencyCode;
  if (!currencyCode)
    throw new Error('برای ارسال قیمت خرید به مالی، ارز خرید را انتخاب کنید.');
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
    amount,
    currencyCode,
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
      payload?.message || 'ثبت قیمت خرید بلیط در کارتابل مالی ناموفق بود.',
    );
  }
  return response.json() as Promise<TicketCatalogPurchaseV1>;
}
