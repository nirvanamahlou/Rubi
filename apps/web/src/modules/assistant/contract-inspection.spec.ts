import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/modules/sales/api/client', () => ({
  SalesApiError: class extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
  },
  salesApi: {
    list: vi.fn(),
    detail: vi.fn(),
    statusHistory: vi.fn().mockResolvedValue({ data: [] }),
  },
}));
import { salesApi, SalesApiError } from '@/modules/sales/api/client';
import { inspectContractQuestion } from './contract-inspection';
import type { SalesContractDetail } from '@nora/contracts';
afterEach(() => vi.clearAllMocks());
const contract = {
  id: 'synthetic-id',
  contractNumber: '123',
  passengerCount: 5,
  passengersDetail: [],
  services: ['FLIGHT'],
  status: 'CONFIRMED',
  settlementStatus: 'PARTIALLY_SETTLED',
  reservationStatus: 'QUEUED',
  updatedAt: '2026-11-11T10:00:00Z',
  balances: [
    {
      currencyCode: 'IRR',
      amount: '1000',
      confirmedPaid: '400',
      pendingFinance: '100',
      outstanding: '600',
    },
    {
      currencyCode: 'USD',
      amount: '50',
      confirmedPaid: '0',
      pendingFinance: '0',
      outstanding: '50',
    },
  ],
} as unknown as SalesContractDetail;
describe('contract inspection', () => {
  it('finds an exact reference beyond the first page without reading a similar number', async () => {
    const page = (n: number, id: string, contractNumber: string) =>
      ({
        data: [{ ...contract, id, contractNumber }],
        meta: { page: n, pageSize: 1, total: 2 },
      }) as Awaited<ReturnType<typeof salesApi.list>>;
    vi.mocked(salesApi.list)
      .mockResolvedValueOnce(page(1, 'wrong', '1230'))
      .mockResolvedValueOnce(page(2, contract.id, '123'));
    vi.mocked(salesApi.detail).mockResolvedValue({ data: contract });
    expect((await inspectContractQuestion('قرارداد ۱۲۳'))?.contractId).toBe(
      contract.id,
    );
    expect(salesApi.detail).toHaveBeenCalledTimes(1);
  });
  it('requests clarification for multiple records without reading either one', async () => {
    expect(
      (await inspectContractQuestion('قرارداد ۱۲۳ و ۴۵۶'))?.contractId,
    ).toBeUndefined();
    expect(salesApi.list).not.toHaveBeenCalled();
  });
  it('does not query a contract for general guidance', async () => {
    expect(
      await inspectContractQuestion('چطور قرارداد بسازم؟'),
    ).toBeUndefined();
    expect(salesApi.detail).not.toHaveBeenCalled();
  });
  it('requires an exact reference before reading a search result', async () => {
    vi.mocked(salesApi.list).mockResolvedValue({
      data: [{ id: 'another', contractNumber: '12345' }],
      meta: { total: 1, page: 1, pageSize: 10 },
    } as unknown as Awaited<ReturnType<typeof salesApi.list>>);
    const result = await inspectContractQuestion('قرارداد ۱۲۳ را بررسی کن');
    expect(result?.contractId).toBeUndefined();
    expect(salesApi.detail).not.toHaveBeenCalled();
  });
  it('refreshes the same authorized record on follow-up and preserves each currency and legacy headcount', async () => {
    vi.mocked(salesApi.detail).mockResolvedValue({ data: contract });
    const first = await inspectContractQuestion(
      'این قرارداد چرا متوقف شده؟',
      contract.id,
    );
    expect(first?.text).toContain('در صف');
    expect(first?.text).toContain('مسافران ثبت‌شده 5');
    expect(first?.text).toContain('ارز IRR، مبلغ 1000');
    expect(first?.text).toContain('ارز USD، مبلغ 50');
    vi.mocked(salesApi.detail).mockResolvedValue({
      data: { ...contract, reservationStatus: 'FULFILLED' },
    });
    expect(
      (await inspectContractQuestion('حالا کجا بروم؟', first?.contractId))
        ?.text,
    ).toContain('تکمیل شده');
    expect(salesApi.detail).toHaveBeenCalledTimes(2);
  });
  it('does not retain a readable record after permission denial', async () => {
    vi.mocked(salesApi.detail).mockRejectedValue(
      new SalesApiError('denied', 403),
    );
    const result = await inspectContractQuestion('حالا کجا بروم؟', contract.id);
    expect(result?.contractId).toBeUndefined();
    expect(result?.text).toContain('دسترسی');
    expect(result?.text).not.toContain('1000');
  });
  it('handles an unavailable source without claiming a contract status', async () => {
    vi.mocked(salesApi.list).mockRejectedValue(new Error('offline'));
    expect((await inspectContractQuestion('قرارداد 123'))?.text).toContain(
      'انجام نشد',
    );
  });
});
