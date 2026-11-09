import type { TravisDiagnosticError } from './travis-sandbox.service';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { InsuranceSettingsService } from './insurance-settings';
import { TravisSandboxService } from './travis-sandbox.service';
const key = 'synthetic-sandbox-test-key';
it('accepts only a verified active policy and upgrades its fixed PDF host to HTTPS', async () => {
  const fetcher = vi.fn(async () =>
    response([
      {
        policyId: 123,
        policyNo: 'VERIFIED-123',
        lastStatus: 'Active',
        payablePremium: 399000,
        plan: { premiumCurrencyCode: 'IRR' },
        pdfUrl:
          'http://sandbox.travis.ir/Print/PolicyPdf/11111111-1111-4111-8111-111111111111/true',
        person: { nationalCode: 'not-exposed' },
      },
    ]),
  );
  vi.stubGlobal('fetch', fetcher);
  const provider = new TravisSandboxService();
  const result = await provider.policy(123);
  expect(result).toMatchObject({
    providerId: '123',
    active: true,
    policyNumber: 'VERIFIED-123',
    amount: '399000',
    pdfUrl:
      'https://sandbox.travis.ir/Print/PolicyPdf/11111111-1111-4111-8111-111111111111/true',
  });
  expect(JSON.stringify(result)).not.toContain('not-exposed');
  for (const url of [
    'https://evil.test/a.pdf',
    'http://127.0.0.1/a.pdf',
    'https://sandbox.travis.ir/other',
    'https://sandbox.travis.ir/Print/PolicyPdf/11111111-1111-4111-8111-111111111111/true?token=x',
  ])
    expect(() => provider.policyPdfUrl(url)).toThrow();
});
it('downloads the original bounded PDF without forwarding the API credential to the print host', async () => {
  const fetcher = vi
    .fn<(url: string, options?: RequestInit) => Promise<Response>>()
    .mockResolvedValue(new Response('%PDF-synthetic'));
  vi.stubGlobal('fetch', fetcher);
  const provider = new TravisSandboxService();
  expect(
    (
      await provider.policyPdf(
        'http://sandbox.travis.ir/Print/PolicyPdf/11111111-1111-4111-8111-111111111111/true',
      )
    ).toString(),
  ).toBe('%PDF-synthetic');
  expect(fetcher.mock.calls[0]?.[1]).not.toHaveProperty('headers');
  fetcher.mockResolvedValueOnce(new Response('<html>not a PDF</html>'));
  await expect(
    provider.policyPdf(
      'https://sandbox.travis.ir/Print/PolicyPdf/11111111-1111-4111-8111-111111111111/true',
    ),
  ).rejects.toThrow();
});
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
      /اطلاعات بیمه دریافت نشد|دسترسی یا کلید اتصال بیمه تأیید نشد/,
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

it('returns bounded actionable provider validation fields without echoing sensitive response values', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(
      () =>
        new Response(
          JSON.stringify({
            code: 400,
            message: 'SECRET-PASSPORT-123',
            errors: {
              'Person.Mobile': ['09123456789'],
              'person.email': ['private@example.test'],
              'SECRET-PASSPORT-123': ['api-key'],
            },
          }),
          { status: 400 },
        ),
    ),
  );
  await expect(new TravisSandboxService().createPolicy({})).rejects.toThrow(
    'موبایل، ایمیل',
  );
  try {
    await new TravisSandboxService().createPolicy({});
  } catch (error) {
    expect(String(error)).not.toMatch(/SECRET|091234|private@|api-key/);
    expect(String(error)).toContain('400');
    expect(String(error)).toContain('ثبت درخواست');
  }
});
it.each([401, 403, 429, 503])(
  'distinguishes provider HTTP failure %s without disclosing HTML',
  async (status) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('<html>SECRET</html>', { status })),
    );
    await expect(new TravisSandboxService().createPolicy({})).rejects.toThrow(
      String(status),
    );
  },
);

it.each([
  ['2024-03-20', '1403/01/01'],
  ['2025-03-20', '1403/12/30'],
])(
  'sends the derived Jalali birth date for Gregorian %s without altering the saved input',
  async (date, expected) => {
    const input = {
      person: {
        isIranian: true,
        birthDate: date + 'T00:00:00.000Z',
        nationalCode: '1234567890',
      },
    };
    const before = structuredClone(input);
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ code: 200, data: { policyId: 17 } }));
    vi.stubGlobal('fetch', fetcher);
    expect(await new TravisSandboxService().createPolicy(input)).toBe(17);
    const sent = JSON.parse(fetcher.mock.calls[0]?.[1].body);
    expect(sent.person.jalaliBirthDate).toBe(expected);
    expect(sent.person.birthDate).toBe(input.person.birthDate);
    expect(input).toEqual(before);
  },
);
it('retains the exact provider validation message and HTTP/business codes while redacting request secrets', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json({
        code: 400,
        messages: [
          'تاریخ تولد شمسی اجباری است',
          'Passport ABC1234567 private@example.test ' + key,
        ],
        data: null,
        errors: null,
      }),
    ),
  );
  try {
    await new TravisSandboxService().createPolicy({
      person: {
        passportNo: 'ABC1234567',
        email: 'private@example.test',
        birthDate: '1990-01-01',
      },
    });
    expect.fail('must reject');
  } catch (error) {
    expect(String(error)).toContain('تاریخ تولد شمسی اجباری است');
    expect(String(error)).not.toMatch(
      /ABC1234567|private@example|synthetic-sandbox-test-key/,
    );
    expect((error as TravisDiagnosticError).providerDiagnostic).toMatchObject({
      httpStatus: 200,
      code: 400,
      messages: expect.arrayContaining(['تاریخ تولد شمسی اجباری است']),
    });
  }
});

it('accepts omitted sandbox correlation only with a trusted creation receipt and matching nested plan and identity', async () => {
  const row = {
    policyId: 17,
    contractNo: null,
    planId: 0,
    plan: { id: 76 },
    passportNo: 'SYNTHETIC',
    person: { nationalCode: 'SYNTHETIC' },
    lastStatus: 'Pending',
  };
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => Promise.resolve(response([row]))),
  );
  const expected = {
    contractNo: 'contract',
    planId: 76,
    passportNo: 'SYNTHETIC',
    nationalCode: 'SYNTHETIC',
  };
  const provider = new TravisSandboxService();
  await expect(provider.policy(17, expected)).rejects.toThrow();
  await expect(
    provider.policy(17, { ...expected, trustedCreation: true }),
  ).resolves.toMatchObject({ providerId: '17', active: false });
  for (const change of [
    { contractNo: 'other' },
    { plan: { id: 77 } },
    { passportNo: 'OTHER' },
    { person: { nationalCode: 'OTHER' } },
  ]) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response([{ ...row, ...change }])),
    );
    await expect(
      provider.policy(17, { ...expected, trustedCreation: true }),
    ).rejects.toThrow();
  }
});
