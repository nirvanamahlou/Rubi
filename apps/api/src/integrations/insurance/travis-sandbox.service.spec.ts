import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { InsuranceSettingsService } from './insurance-settings';
import { TravisSandboxService } from './travis-sandbox.service';
const key = 'synthetic-sandbox-test-key';
const countries = [
  { id: 1, title: 'Synthetic', standardCode: 'IR', ignored: 'not exposed' },
];
function response(data: unknown, code = 200) {
  return Response.json({ code, data, messages: [], errors: null });
}
beforeEach(() => {
  vi.stubEnv('TRAVIS_SANDBOX_ENABLED', 'true');
  vi.stubEnv('TRAVIS_SANDBOX_BASE_URL', 'https://sandboxapi.travis.ir');
  vi.stubEnv('TRAVIS_SANDBOX_API_KEY', key);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function transport() {
  const fetcher = vi.fn(async (url: string) =>
    url.endsWith('Countries')
      ? response(countries)
      : url.endsWith('Search')
        ? response([{ id: 2, title: 'Synthetic Plan', titleEnglish: 'Test' }])
        : response([{ toDOS: 7, display: '7 days' }]),
  );
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
it('uses only fixed HTTPS read endpoints with server-only key and projects catalog fields', async () => {
  const fetcher = transport();
  const result = await new TravisSandboxService().catalog();
  expect(result).toEqual({
    providerStatus: 'SANDBOX_CONNECTED',
    countries: [{ id: 1, title: 'Synthetic', standardCode: 'IR' }],
    durations: [{ days: 7, title: '7 days' }],
    plans: [{ id: 2, title: 'Synthetic Plan', englishTitle: 'Test' }],
  });
  expect(JSON.stringify(result)).not.toContain(key);
  expect(fetcher).toHaveBeenCalledTimes(3);
  for (const [url, options] of fetcher.mock.calls as unknown as [
    string,
    RequestInit,
  ][]) {
    expect(url).toMatch(
      /^https:\/\/sandboxapi\.travis\.ir\/api\/(General\/(Countries|Duration-Of-Stays)|Plans\/Search)$/,
    );
    expect(options).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: { 'x-api-key': key },
    });
  }
});
it.each([
  ['TRAVIS_SANDBOX_ENABLED', 'false'],
  ['TRAVIS_SANDBOX_API_KEY', ''],
  ['TRAVIS_SANDBOX_BASE_URL', 'https://production.invalid'],
  ['TRAVIS_SANDBOX_BASE_URL', 'http://sandboxapi.travis.ir'],
])('fails closed for %s', async (name, value) => {
  vi.stubEnv(name, value);
  const fetcher = transport();
  const service = new TravisSandboxService();
  expect(service.configured()).toBe(false);
  await expect(service.catalog()).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([
  () => Promise.reject(new Error(key)),
  () => Promise.resolve(response([], 401)),
  () => Promise.resolve(new Response(key, { status: 401 })),
  () => Promise.resolve(response({ credential: key })),
  () => Promise.resolve(response([{ id: 'bad', title: key }])),
  () => Promise.resolve(new Response('x'.repeat(2_000_001))),
])(
  'redacts authentication/network/invalid/oversized failures',
  async (make) => {
    vi.stubGlobal('fetch', vi.fn(make));
    await expect(new TravisSandboxService().catalog()).rejects.toThrow(
      'اطلاعات بیمه دریافت نشد.',
    );
  },
);
it('requires branch and settings permission before any provider request', async () => {
  const provider = {
    catalog: vi.fn().mockResolvedValue({ providerStatus: 'SANDBOX_CONNECTED' }),
    configured: () => true,
  };
  const service = new InsuranceSettingsService(
    { resolveSetting: async () => null } as never,
    {} as never,
    provider as never,
  );
  const actor = {
    branchIds: ['branch'],
    permissions: ['reservations.read'],
  } as AuthenticatedActor;
  await expect(service.providerCatalog('branch', actor)).rejects.toThrow();
  await expect(
    service.providerCatalog('other', {
      ...actor,
      permissions: ['reservations.read', 'system.settings.manage'],
    }),
  ).rejects.toThrow();
  expect(provider.catalog).not.toHaveBeenCalled();
  await expect(
    service.providerCatalog('branch', {
      ...actor,
      permissions: ['reservations.read', 'system.settings.manage'],
    }),
  ).resolves.toEqual({ providerStatus: 'SANDBOX_CONNECTED' });
  const settings = await service.read('branch', actor);
  expect(settings.providerStatus).toBe('SANDBOX_CONFIGURED');
  expect(JSON.stringify(settings)).not.toContain(key);
});

it('creates and confirms only a fixed synthetic sandbox policy', async () => {
  const fetcher = vi.fn(async (url: string) =>
    response(
      url.endsWith('Create')
        ? { policyId: 123, redirectUrl: 'ignored' }
        : { policyId: 123, pdfUrl: 'ignored' },
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  expect(await new TravisSandboxService().testIssuance()).toEqual({
    providerStatus: 'SANDBOX_CONNECTED',
    sandboxOnly: true,
    policyId: 123,
    confirmed: true,
  });
  const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
  expect(calls[0]![0]).toBe('https://sandboxapi.travis.ir/api/Policies/Create');
  expect(JSON.parse(calls[0]![1].body as string).person.nationalCode).toBe(
    'SANDBOXTEST',
  );
  expect(calls[1]).toEqual([
    'https://sandboxapi.travis.ir/api/Policies/Confirm',
    expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ policyId: 123 }),
    }),
  ]);
});
it('rejects mismatched confirmation identity', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      response({ policyId: url.endsWith('Create') ? 123 : 124 }),
    ),
  );
  await expect(new TravisSandboxService().testIssuance()).rejects.toThrow(
    'اطلاعات بیمه دریافت نشد.',
  );
});
it('imports supported provider rates without inventing zero prices for unavailable bands', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options: RequestInit) => {
      if (url.endsWith('Countries'))
        return response([
          { id: 5, title: 'Turkey', standardCode: 'TR' },
          { id: 59, title: 'China', standardCode: 'CN' },
          { id: 29, title: 'Georgia', standardCode: 'GE' },
          { id: 30, title: 'Malaysia', standardCode: 'MY' },
        ]);
      if (url.endsWith('Duration-Of-Stays'))
        return response([
          { toDOS: 7, display: '7' },
          { toDOS: 15, display: '15' },
          { toDOS: 45, display: '45' },
        ]);
      const body = JSON.parse(options.body as string);
      if (!body.planId) return response([{ id: 76, title: 'Festival' }]);
      return response(
        body.durationOfStay > 15
          ? []
          : [{ id: 76, priceTotal: 399000, premiumCurrencyCode: 'IRR' }],
      );
    }),
  );
  const rows = await new TravisSandboxService().festivalRates();
  expect(rows).toHaveLength(4);
  for (const row of rows) {
    expect(row.unsupported).toBe(6);
    expect(row.rates).toHaveLength(12);
    expect(
      row.rates.every(
        (r) =>
          r.amount === '399000' && r.currencyCode === 'IRR' && r.maxDays <= 15,
      ),
    ).toBe(true);
    expect(row.rates.some((r) => r.minDays === 8 && r.maxDays === 15)).toBe(
      true,
    );
  }
});
