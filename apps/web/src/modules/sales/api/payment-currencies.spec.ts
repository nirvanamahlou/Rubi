import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MasterDataRecord } from '@rubi/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';
import { loadPaymentCurrencies } from './payment-currencies';

afterEach(() => vi.restoreAllMocks());
const usd = {
  id: 'usd',
  code: 'USD',
  name: 'دلار',
  status: 'active',
} as MasterDataRecord;
describe('dashboard payment currency reference list', () => {
  it('requests active registered currencies and loads subsequent pages', async () => {
    const list = vi
      .spyOn(masterDataApi, 'list')
      .mockResolvedValueOnce({
        data: [usd],
        meta: { total: 101, page: 1, pageSize: 100 },
      })
      .mockResolvedValueOnce({
        data: [{ ...usd, id: 'irr', code: 'IRR' }],
        meta: { total: 101, page: 2, pageSize: 100 },
      });
    expect((await loadPaymentCurrencies()).map((item) => item.code)).toEqual([
      'USD',
      'IRR',
    ]);
    expect(list).toHaveBeenNthCalledWith(
      2,
      'currencies',
      expect.objectContaining({ status: 'active', page: 2, pageSize: 100 }),
    );
  });
  it('does not invent IRR when no currency is available', async () => {
    vi.spyOn(masterDataApi, 'list').mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, pageSize: 100 },
    });
    expect(await loadPaymentCurrencies()).toEqual([]);
  });
  it('fails on unavailable or incomplete reference loading', async () => {
    const list = vi
      .spyOn(masterDataApi, 'list')
      .mockRejectedValueOnce(new Error('Unavailable'));
    await expect(loadPaymentCurrencies()).rejects.toThrow();
    list.mockResolvedValue({
      data: [],
      meta: { total: 101, page: 1, pageSize: 100 },
    });
    await expect(loadPaymentCurrencies()).rejects.toThrow('دریافت کامل');
  });
});
