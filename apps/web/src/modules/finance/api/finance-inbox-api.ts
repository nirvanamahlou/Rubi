'use client';

import type {
  FinanceBankOptionV1,
  FinanceInboxV1,
  FinancePaymentMethodOptionV1,
  FinanceReceiptDecisionCommandV1,
  FinanceSettlementAccountCreateV1,
  FinanceSettlementAccountV1,
  FinanceSupplierPaymentCommandV1,
  FinanceTicketCostCommandV1,
  FinanceTicketPaymentCommandV1,
} from '@nora/contracts';

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

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl)
    throw new FinanceInboxApiError('نشانی API کارتابل مالی تنظیم نشده است.', 0);
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
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
    return apiRequest(path, init, true);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
      error?: { message?: string };
    } | null;
    throw new FinanceInboxApiError(
      response.status === 401
        ? 'نشست ورود پایان یافته است؛ دوباره وارد شوید.'
        : response.status === 403
          ? path === '/finance/inbox'
            ? 'برای مشاهده کارتابل مالی مجوز ندارید.'
            : 'برای انجام این عملیات مالی مجوز ندارید.'
          : (payload?.error?.message ??
            payload?.message ??
            'عملیات کارتابل مالی ناموفق بود.'),
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

export const financeInboxApi = {
  list: () => apiRequest<FinanceInboxV1>('/finance/inbox'),
  accounts: async () =>
    (
      await apiRequest<{ data: readonly FinanceSettlementAccountV1[] }>(
        '/finance/settlement-accounts',
      )
    ).data,
  methods: async () =>
    (
      await apiRequest<{ data: readonly FinancePaymentMethodOptionV1[] }>(
        '/finance/payment-methods',
      )
    ).data,
  banks: async () =>
    (
      await apiRequest<{ data: readonly FinanceBankOptionV1[] }>(
        '/finance/account-banks',
      )
    ).data,
  createAccount: async (input: FinanceSettlementAccountCreateV1) =>
    (
      await apiRequest<{ data: FinanceSettlementAccountV1 }>(
        '/finance/settlement-accounts',
        { method: 'POST', body: JSON.stringify(input) },
      )
    ).data,
  decideReceipt: (paymentId: string, input: FinanceReceiptDecisionCommandV1) =>
    apiRequest<{ data: { status: string } }>(
      `/finance/inbox/sales/${encodeURIComponent(paymentId)}/decision`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  paySupplier: (
    intakeId: string,
    purchaseId: string,
    input: FinanceSupplierPaymentCommandV1,
  ) =>
    apiRequest<{ data: unknown }>(
      `/finance/inbox/reservations/${encodeURIComponent(intakeId)}/purchases/${encodeURIComponent(purchaseId)}/payments`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  recordTicketCost: (requestId: string, input: FinanceTicketCostCommandV1) =>
    apiRequest<{ data: unknown }>(
      `/finance/ticket-purchases/${encodeURIComponent(requestId)}/costs`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  payTicket: (requestId: string, input: FinanceTicketPaymentCommandV1) =>
    apiRequest<{ data: unknown }>(
      `/finance/ticket-purchases/${encodeURIComponent(requestId)}/payments`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
};
