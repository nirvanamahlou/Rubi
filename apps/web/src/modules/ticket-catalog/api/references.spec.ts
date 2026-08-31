import { afterEach, describe, expect, it, vi } from 'vitest';
import { asReference, listReferences } from './references';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('Published read-only Master Data adapter', () => {
  it('fails closed without configuration', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '');
    await expect(listReferences('airlines', '', 1)).rejects.toMatchObject({
      state: 'unavailable',
    });
  });
  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [409, 'conflict'],
    [500, 'error'],
  ])('surfaces HTTP %s without synthetic fallback', async (status, state) => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
    await expect(listReferences('airlines', '', 1)).rejects.toMatchObject({
      state,
    });
  });
  it('uses GET, existing endpoints, encoded query and session cookies', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
        meta: { total: 0, page: 2, pageSize: 25 },
      }),
    });
    vi.stubGlobal('fetch', fetcher);
    await listReferences('currencies', 'a&b', 2);
    expect(fetcher.mock.calls[0]![0]).toContain(
      '/api/v1/master-data/currencies?search=a%26b&status=active',
    );
    expect(fetcher.mock.calls[0]![1]).toMatchObject({
      method: 'GET',
      credentials: 'include',
    });
    expect(fetcher.mock.calls[0]![0]).not.toContain('legal');
  });
  it('rejects malformed or cross-resource responses', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'x', resource: 'cities' }],
          meta: { total: 1, page: 1, pageSize: 25 },
        }),
      }),
    );
    await expect(listReferences('airlines', '', 1)).rejects.toMatchObject({
      state: 'error',
    });
  });
  it('retains inactive state in selected snapshots', () => {
    expect(
      asReference({
        id: 'test',
        resource: 'airlines',
        code: 'XX',
        name: 'Synthetic',
        status: 'inactive',
        attributes: {},
        version: 1,
        createdAt: '',
        updatedAt: '',
      })?.active,
    ).toBe(false);
  });
});

it('maps country and city identities with their published parent relationship', () => {
  const record = {
    id: 'city-test',
    resource: 'cities' as const,
    code: 'TC',
    name: 'Test City',
    status: 'active' as const,
    attributes: { countryId: 'country-test' },
    version: 1,
    createdAt: '',
    updatedAt: '',
  };
  expect(asReference(record)).toMatchObject({
    id: 'city-test',
    kind: 'city',
    countryId: 'country-test',
  });
  expect(
    asReference({
      ...record,
      id: 'country-test',
      resource: 'countries',
      attributes: {},
    }),
  ).toMatchObject({ kind: 'country' });
});
