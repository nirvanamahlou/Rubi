import { describe, expect, it, vi } from 'vitest';
import { loadSalesAcquaintanceMethods } from './acquaintance-methods';
describe('Sales acquaintance method catalog', () => {
  it('loads active public reference pages, filters and deduplicates', async () => {
    const first = {
      id: 'a',
      resource: 'acquaintance-methods',
      status: 'active',
      name: 'معرفی',
    };
    const second = { ...first, id: 'b', name: 'اینستاگرام' };
    const list = vi
      .fn()
      .mockResolvedValueOnce({ data: [first], meta: { total: 4 } })
      .mockResolvedValueOnce({
        data: [first, second, { ...first, id: 'old', status: 'inactive' }],
        meta: { total: 4 },
      });
    expect(await loadSalesAcquaintanceMethods(list)).toEqual([first, second]);
    expect(list).toHaveBeenNthCalledWith(
      2,
      'acquaintance-methods',
      expect.objectContaining({ page: 2, status: 'active' }),
    );
  });
  it('surfaces failed/partial lists and returns an empty catalog without invented options', async () => {
    await expect(
      loadSalesAcquaintanceMethods(
        vi.fn().mockRejectedValue(new Error('offline')),
      ),
    ).rejects.toThrow('offline');
    await expect(
      loadSalesAcquaintanceMethods(
        vi.fn().mockResolvedValue({ data: [], meta: { total: 1 } }),
      ),
    ).rejects.toThrow('کامل');
    expect(
      await loadSalesAcquaintanceMethods(
        vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
      ),
    ).toEqual([]);
  });
});
