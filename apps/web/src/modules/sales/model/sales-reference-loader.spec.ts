import type * as MasterDataClient from '@/modules/master-data/api/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  masterDataApi,
  MasterDataApiError,
} from '@/modules/master-data/api/client';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { loadSalesReferences } from './sales-reference-loader';
vi.mock('@/modules/master-data/api/client', async (original) => ({
  ...(await original<typeof MasterDataClient>()),
  masterDataApi: { list: vi.fn() },
}));
vi.mock('@/lib/auth-session', () => ({ refreshAuthenticatedSession: vi.fn() }));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'https://synthetic.invalid/api/v1',
}));
const list = vi.mocked(masterDataApi.list);
const refresh = vi.mocked(refreshAuthenticatedSession);
const page = (data: unknown[] = [], total = data.length) =>
  ({ data, meta: { page: 1, pageSize: 100, total } }) as Awaited<
    ReturnType<typeof masterDataApi.list>
  >;
beforeEach(() => {
  list.mockReset().mockResolvedValue(page());
  refresh.mockReset();
});
describe('sales reference recovery', () => {
  it('refreshes an expired session and retries the failed read', async () => {
    list.mockImplementation(async (resource) => {
      if (
        resource === 'hotels' &&
        list.mock.calls.filter(([r]) => r === 'hotels').length === 1
      )
        throw new MasterDataApiError('Expired', 401);
      return page();
    });
    refresh.mockResolvedValue({} as never);
    const result = await loadSalesReferences();
    expect(refresh).toHaveBeenCalledWith('https://synthetic.invalid/api/v1');
    expect(result.failures).toEqual([]);
    expect(result.references.hotels).toEqual([]);
    expect(list.mock.calls.filter(([r]) => r === 'hotels')).toHaveLength(2);
  });
  it('retains successful groups and identifies permission failures without retrying them', async () => {
    list.mockImplementation(async (resource) => {
      if (resource === 'banks') throw new MasterDataApiError('Forbidden', 403);
      return page([{ id: resource }]);
    });
    const result = await loadSalesReferences();
    expect(result.references.hotels).toEqual([{ id: 'hotels' }]);
    expect(result.references).not.toHaveProperty('banks');
    expect(result.failures).toEqual([{ label: 'بانک‌ها', status: 403 }]);
    expect(refresh).not.toHaveBeenCalled();
    expect(list.mock.calls.filter(([r]) => r === 'banks')).toHaveLength(1);
  });
  it.each([new TypeError('Network'), new MasterDataApiError('Temporary', 503)])(
    'retries a transient failure once',
    async (error) => {
      list.mockRejectedValueOnce(error);
      expect((await loadSalesReferences()).failures).toEqual([]);
      expect(list).toHaveBeenCalledTimes(8);
    },
  );
  it('does not loop when session recovery fails', async () => {
    list.mockRejectedValue(new MasterDataApiError('Expired', 401));
    refresh.mockResolvedValue(null);
    expect((await loadSalesReferences()).failures).toHaveLength(7);
    expect(list).toHaveBeenCalledTimes(7);
  });
  it('loads every page of an active group', async () => {
    list.mockImplementation(async (resource, query) =>
      resource === 'hotels' ? page([{ id: String(query.page) }], 2) : page(),
    );
    expect((await loadSalesReferences()).references.hotels).toEqual([
      { id: '1' },
      { id: '2' },
    ]);
  });
});
