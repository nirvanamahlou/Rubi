import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { masterDataApi } from '@/modules/master-data/api/client';
import {
  asReference,
  getActiveCityReference,
  listActiveCurrencyReferences,
  listReferences,
} from './references';
vi.mock('@/lib/auth-session');
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('Published read-only Master Data adapter', () => {
  it.each([
    {
      read: () => listReferences('cities', '', 1, undefined, {}, 'sales'),
      expected: '/selections/sales/cities?',
    },
    {
      read: () =>
        masterDataApi.list('organizations', {
          page: 1,
          pageSize: 20,
          search: '',
          status: 'all',
          sortBy: 'updatedAt',
          sortDirection: 'desc',
        }),
      expected: '/organizations?',
    },
  ])(
    'retries a read once with the refreshed session: $expected',
    async ({ read, expected }) => {
      vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
      const refresh = vi.mocked(refreshAuthenticatedSession);
      refresh.mockClear();
      refresh.mockResolvedValue(
        {} as NonNullable<
          Awaited<ReturnType<typeof refreshAuthenticatedSession>>
        >,
      );
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(
          Response.json({
            data: [],
            meta: { total: 0, page: 1, pageSize: 25 },
          }),
        );
      vi.stubGlobal('fetch', fetcher);
      await expect(read()).resolves.toMatchObject({ data: [] });
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(fetcher.mock.calls[0]?.[0]).toContain(expected);
      expect(fetcher.mock.calls[1]?.[0]).toBe(fetcher.mock.calls[0]?.[0]);
    },
  );

  it.each([
    { scope: 'iran', attributes: { cityId: 'tehran' }, expected: 'iran' },
    { scope: undefined, attributes: { cityId: 'tehran' }, expected: undefined },
    {
      scope: 'iran',
      attributes: { cityId: 'istanbul', countryId: 'turkey' },
      expected: 'turkey',
    },
  ])(
    'keeps airport country provenance for scoped and unscoped reads: $expected',
    async ({ scope, attributes, expected }) => {
      vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
      const fetcher = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'airport-thr',
              resource: 'airports',
              code: 'THR',
              name: 'فرودگاه مهرآباد',
              status: 'active',
              attributes,
              version: 1,
              createdAt: '',
              updatedAt: '',
            },
          ],
          meta: { total: 1, page: 1, pageSize: 25 },
        }),
      });
      vi.stubGlobal('fetch', fetcher);
      const result = await listReferences(
        'airports',
        'مهرآباد',
        1,
        undefined,
        scope ? { countryId: scope } : {},
      );
      expect(asReference(result.data[0]!)?.countryId).toBe(expected);
      expect(asReference(result.data[0]!)?.cityId).toBe(attributes.cityId);
      const requested = new URL(fetcher.mock.calls[0]![0]);
      expect(requested.searchParams.get('countryId')).toBe(scope ?? null);
    },
  );

  it('does not infer a missing country on other reference resources', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'city',
              resource: 'cities',
              code: 'CITY',
              name: 'City',
              status: 'active',
              attributes: {},
              version: 1,
              createdAt: '',
              updatedAt: '',
            },
          ],
          meta: { total: 1, page: 1, pageSize: 25 },
        }),
      }),
    );
    const result = await listReferences('cities', '', 1, undefined, {
      countryId: 'iran',
    });
    expect(asReference(result.data[0]!)?.countryId).toBeUndefined();
  });

  it('resolves a saved city id to its current human-readable name', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'city-1',
          resource: 'cities',
          code: 'CITY_TEST',
          name: 'آنتالیا',
          status: 'active',
          attributes: {},
          version: 1,
          createdAt: '',
          updatedAt: '',
        },
      }),
    });
    vi.stubGlobal('fetch', fetcher);
    await expect(getActiveCityReference('city-1')).resolves.toMatchObject({
      id: 'city-1',
      kind: 'city',
      name: 'آنتالیا',
    });
    expect(fetcher.mock.calls[0]![0]).toContain(
      '/master-data/selections/ticket-catalog/cities/city-1',
    );
  });
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
      '/api/v1/master-data/selections/ticket-catalog/currencies?search=a%26b&status=active',
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

  it('loads every active currency page and returns unique ISO options', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
    const currency = (id: string, code: string, name: string) => ({
      id,
      resource: 'currencies' as const,
      code,
      name,
      status: 'active' as const,
      attributes: {},
      version: 1,
      createdAt: '',
      updatedAt: '',
    });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [currency('irr', 'IRR', 'ریال')],
          meta: { total: 26, page: 1, pageSize: 25 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            currency('usd', 'usd', 'دلار'),
            currency('usd-duplicate', 'USD', 'دلار تکراری'),
          ],
          meta: { total: 26, page: 2, pageSize: 25 },
        }),
      });
    vi.stubGlobal('fetch', fetcher);

    await expect(listActiveCurrencyReferences()).resolves.toEqual([
      expect.objectContaining({ code: 'IRR', name: 'ریال' }),
      expect.objectContaining({ code: 'USD', name: 'دلار' }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
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
      ianaTimezone: 'Asia/Tehran',
    },
    version: 1,
    createdAt: '',
    updatedAt: '',
  };
  expect(asReference({ ...base, resource: 'airports' })).toMatchObject({
    kind: 'airport',
    cityId: '22222222-2222-4222-8222-222222222222',
    timezone: 'Asia/Tehran',
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
it('maps published rail and bus references for ticket definitions', () => {
  const base = {
    id: 'transport-reference',
    code: 'TEST',
    name: 'Synthetic transport reference',
    status: 'active' as const,
    attributes: {},
    version: 1,
    createdAt: '',
    updatedAt: '',
  };
  expect(
    ['rail-companies', 'train-types', 'bus-companies', 'bus-types'].map(
      (resource) =>
        asReference({
          ...base,
          resource: resource as
            'rail-companies' | 'train-types' | 'bus-companies' | 'bus-types',
        })?.kind,
    ),
  ).toEqual(['railCompany', 'trainType', 'busCompany', 'busType']);
});
import { getAirportReference } from './references';

it('hydrates the saved airport label and country through the catalog selection endpoint', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
  const record = {
    id: 'saved-airport',
    resource: 'airports',
    name: 'Antalya Airport',
    code: 'AYT',
    status: 'active',
    attributes: { countryId: 'tr', cityId: 'ayt' },
  };
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ data: record }) });
  vi.stubGlobal('fetch', fetcher);
  await expect(getAirportReference('saved-airport')).resolves.toMatchObject({
    id: 'saved-airport',
    name: 'Antalya Airport',
    countryId: 'tr',
  });
  expect(fetcher.mock.calls[0]![0]).toBe(
    'http://localhost:4000/api/v1/master-data/selections/ticket-catalog/airports/saved-airport',
  );
  await expect(
    getAirportReference('different-airport'),
  ).resolves.toBeUndefined();
});
