import { afterEach, describe, expect, it, vi } from 'vitest';

import { financeInboxApi } from './finance-inbox-api';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:4200/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn().mockResolvedValue(null),
}));

afterEach(() => vi.unstubAllGlobals());

describe('Finance inbox API', () => {
  it('responds to HR through its public endpoint with an idempotency key and source version', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'hr-1' })));
    vi.stubGlobal('fetch', fetch);
    await financeInboxApi.respondHr(
      'hr-1',
      { version: 3, status: 'IN_REVIEW', note: 'بررسی مالی' },
      'response-key',
    );
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/v1/hr/connections/hr-1/response',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'idempotency-key': 'response-key' }),
      }),
    );
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({
      version: 3,
      status: 'IN_REVIEW',
    });
  });
  it('routes invoice and return decisions to their own endpoints with Finance CAS versions', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ data: { status: 'APPROVED' } })),
      );
    vi.stubGlobal('fetch', fetch);
    await financeInboxApi.decideInvoice('invoice-1', {
      version: 1,
      expectedVersion: 0,
      action: 'APPROVE',
    });
    await financeInboxApi.payInvoice('invoice-1', {
      version: 1,
      expectedVersion: 2,
      accountId: 'account',
      paymentMethodId: 'method',
      paidAmount: '10',
      transferAt: '2026-10-04T10:00:00Z',
    });
    await financeInboxApi.decideCorrection('return-1', {
      version: 1,
      expectedVersion: 3,
      action: 'CORRECTION_REQUIRED',
      reason: 'اصلاح',
    });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:4200/api/v1/finance/inbox/purchases/invoices/invoice-1/decision',
      'http://localhost:4200/api/v1/finance/inbox/purchases/invoices/invoice-1/payments',
      'http://localhost:4200/api/v1/finance/inbox/purchases/corrections/return-1/decision',
    ]);
    expect(JSON.parse(fetch.mock.calls[1]![1].body)).toMatchObject({
      expectedVersion: 2,
    });
  });
  it('requests persistent installment history with encoded pagination and source filters', async () => {
    const payload = { version: 1, items: [], nextCursor: null };
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(payload)));
    vi.stubGlobal('fetch', fetch);
    await expect(
      financeInboxApi.history({
        source: 'TICKET',
        requestId: 'purchase-1',
        cursor: 'abc+/=',
        direction: 'PAYMENT',
      }),
    ).resolves.toEqual(payload);
    const [url, options] = fetch.mock.calls[0]!;
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/api/v1/finance/transaction-history');
    expect(parsed.searchParams.get('cursor')).toBe('abc+/=');
    expect(parsed.searchParams.get('requestId')).toBe('purchase-1');
    expect(options).toMatchObject({
      credentials: 'include',
      cache: 'no-store',
    });
  });
  it('loads only the authenticated no-cache Finance projection', async () => {
    const payload = {
      version: 1,
      generatedAt: '2026-09-13T00:00:00Z',
      items: [],
      sources: [],
    };
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(financeInboxApi.list()).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/v1/finance/inbox',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });

  it('reports permission and network failures without returning fake rows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 403 })),
    );
    await expect(financeInboxApi.list()).rejects.toMatchObject({
      status: 403,
      message: 'برای مشاهده کارتابل مالی مجوز ندارید.',
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(financeInboxApi.list()).rejects.toMatchObject({ status: 0 });
  });
});
