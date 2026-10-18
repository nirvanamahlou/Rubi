import { afterEach, expect, it, vi } from 'vitest';
import { salesApi } from './client';
import { loadSalesReferences } from './reference-refresh';
import { loadSalesAcquaintanceMethods } from './acquaintance-methods';
import { loadSalesInsurancePlans } from '../model/sales-insurance';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://localhost/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn().mockResolvedValue(null),
}));
afterEach(() => vi.unstubAllGlobals());

it('routes every new-contract reference loader through Sales rather than restricted administration', async () => {
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          data: [],
          meta: { total: 0, page: 1, pageSize: 100 },
        }),
      ),
  );
  vi.stubGlobal('fetch', fetch);
  const result = await loadSalesReferences();
  expect(result.failed).toEqual([]);
  await loadSalesAcquaintanceMethods();
  await loadSalesInsurancePlans();
  await salesApi.listReferences('organizations', {
    search: 'Agency',
    page: 2,
    pageSize: 100,
    status: 'active',
    sortBy: 'name',
    sortDirection: 'asc',
  });
  expect(fetch).toHaveBeenCalledTimes(11);
  for (const [url, options] of fetch.mock.calls as unknown as [
    string,
    RequestInit,
  ][]) {
    expect(url).toContain('/sales/form-references/');
    expect(url).not.toContain('/master-data/');
    expect(options).toMatchObject({
      credentials: 'include',
      cache: 'no-store',
    });
  }
  expect(fetch).toHaveBeenLastCalledWith(
    'http://localhost/api/v1/sales/form-references/organizations?search=Agency&page=2&pageSize=100',
    expect.anything(),
  );
});
