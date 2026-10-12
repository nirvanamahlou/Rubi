import { describe, expect, it, vi } from 'vitest';
import type { MasterDataService } from '../../master-data/master-data.service';
import { accountingCurrencies } from './accounting.currency-directory';

describe('public currency directory boundary', () => {
  it('pages active producer records and returns only accounting references', async () => {
    const list = vi.fn().mockImplementation(async (_entity, query) => ({
      data: [
        {
          id: `currency-${query.page}`,
          version: 7,
          code: `C${query.page}`,
          name: 'ارز',
          attributes: {
            decimalDigits: '2',
            englishName: 'Currency',
            privateValue: 'omit',
          },
          internalMetadata: 'omit',
        },
      ],
      meta: { total: 51 },
    }));
    const result = await accountingCurrencies({
      list,
    } as unknown as MasterDataService);
    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenLastCalledWith('currencies', {
      page: 2,
      pageSize: 50,
      status: 'active',
      sortBy: 'code',
      sortDirection: 'asc',
      search: '',
    });
    expect(result[0]).toEqual({
      id: 'currency-1',
      version: 7,
      code: 'C1',
      name: 'ارز',
      englishName: 'Currency',
      decimalDigits: 2,
    });
  });

  it('fails explicitly when the producer is unavailable or exceeds the bound', async () => {
    await expect(accountingCurrencies()).rejects.toThrow();
    const list = vi.fn().mockResolvedValue({ data: [], meta: { total: 1001 } });
    await expect(
      accountingCurrencies({ list } as unknown as MasterDataService),
    ).rejects.toThrow();
    expect(list).toHaveBeenCalledTimes(20);
  });
});
