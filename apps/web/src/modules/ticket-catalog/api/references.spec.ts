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

it('uses v12 geographic filters and maps all ticket reference kinds', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [],
      meta: { total: 0, page: 1, pageSize: 25 },
    }),
  });
  vi.stubGlobal('fetch', fetcher);
  await listReferences('airports', 'demo', 1, undefined, {
    countryId: '11111111-1111-4111-8111-111111111111',
    cityId: '22222222-2222-4222-8222-222222222222',
  });
  expect(fetcher.mock.calls[0]![0]).toContain(
    'countryId=11111111-1111-4111-8111-111111111111',
  );
  expect(fetcher.mock.calls[0]![0]).toContain(
    'cityId=22222222-2222-4222-8222-222222222222',
  );
  const base = {
    id: 'reference-test',
    code: 'TEST',
    name: 'Synthetic',
    status: 'active' as const,
    attributes: {
      countryId: '11111111-1111-4111-8111-111111111111',
      cityId: '22222222-2222-4222-8222-222222222222',
    },
    version: 1,
    createdAt: '',
    updatedAt: '',
  };
  expect(asReference({ ...base, resource: 'airports' })).toMatchObject({
    kind: 'airport',
    cityId: '22222222-2222-4222-8222-222222222222',
  });
  expect(
    ['aircraft-types', 'cabin-classes', 'baggage-rules'].map(
      (resource) =>
        asReference({
          ...base,
          resource: resource as
            'aircraft-types' | 'cabin-classes' | 'baggage-rules',
        })?.kind,
    ),
  ).toEqual(['aircraft', 'flightClass', 'baggage']);
});
