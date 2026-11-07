import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedActor } from '@nora/contracts';
import type { MasterDataService } from '../../master-data/master-data.service';
import type { SystemManagementService } from '../../system-management/system-management.service';
import {
  insuranceConfiguration,
  InsuranceSettingsService,
} from './insurance-settings';

const config = () => ({
  schemaVersion: 1,
  countries: [
    {
      countryId: randomUUID(),
      providerCountryCode: '90',
      providerCountryName: 'Synthetic',
      englishName: 'Synthetic',
      active: true,
      plans: [
        {
          masterPlanId: randomUUID(),
          providerPlanCode: 'P1',
          title: 'Test plan',
          rates: [
            {
              minDays: 1,
              maxDays: 7,
              minAge: 0,
              maxAge: 12,
              amount: '123456789012345.1234',
              currencyCode: 'IRR',
            },
          ],
        },
      ],
    },
  ],
});
it('creates the initial setting without an invalid zero system version', async () => {
  const branchId = randomUUID();
  const writeSetting = vi.fn();
  const service = new InsuranceSettingsService(
    { writeSetting, resolveSetting: async () => null } as never,
    {} as never,
  );
  const actor = {
    branchIds: [branchId],
    permissions: ['reservations.read', 'reservations.insurance.manage'],
  } as AuthenticatedActor;
  await service.save(
    branchId,
    { expectedVersion: 0, config: { schemaVersion: 1, countries: [] } },
    actor,
  );
  expect(writeSetting).toHaveBeenCalledWith(
    expect.objectContaining({
      expectedVersion: undefined,
      scope: 'BRANCH',
      scopeId: branchId,
    }),
    actor,
    {},
  );
});

describe('insurance issuance configuration', () => {
  it('retains exact decimal money and explicit inclusive boundaries', () => {
    const input = config();
    expect(insuranceConfiguration(input)).toEqual(input);
  });
  it.each(['-2', '1e6', 'NaN', '1.00001'])(
    'rejects invalid money %s',
    (amount) => {
      const input = config();
      input.countries[0]!.plans[0]!.rates[0]!.amount = amount;
      expect(() => insuranceConfiguration(input)).toThrow();
    },
  );
  it('rejects overlapping rate rectangles but allows adjacent age ranges', () => {
    const input = config(),
      rates = input.countries[0]!.plans[0]!.rates;
    rates.push({ ...rates[0]!, minAge: 12, maxAge: 65 });
    expect(() => insuranceConfiguration(input)).toThrow();
    rates[1]!.minAge = 13;
    expect(() => insuranceConfiguration(input)).not.toThrow();
  });
  it('rejects duplicate mappings, zero travel duration and secret fields', () => {
    const input = config();
    expect(() =>
      insuranceConfiguration({ ...input, apiKey: 'test' }),
    ).toThrow();
    expect(() =>
      insuranceConfiguration({
        ...input,
        countries: [...input.countries, ...input.countries],
      }),
    ).toThrow();
    input.countries[0]!.plans[0]!.rates[0]!.minDays = 0;
    expect(() => insuranceConfiguration(input)).toThrow();
  });
  it('does not return another scope or permit a foreign branch', async () => {
    const branchId = randomUUID();
    const settings = {
      resolveSetting: vi
        .fn()
        .mockResolvedValue({ scope: 'GLOBAL', value: config(), version: 7 }),
    };
    const service = new InsuranceSettingsService(
      settings as unknown as SystemManagementService,
      {} as MasterDataService,
    );
    const actor = {
      permissions: ['reservations.read'],
      branchIds: [branchId],
    } as AuthenticatedActor;
    const result = await service.read(branchId, actor);
    expect(result.config.countries).toEqual([]);
    expect(result.version).toBe(0);
    expect(result.canManage).toBe(false);
    await expect(service.read(randomUUID(), actor)).rejects.toThrow();
    await expect(
      service.save(branchId, { config: config(), expectedVersion: 0 }, actor),
    ).rejects.toThrow();
  });
});

it('imports plan 76 while preserving unrelated saved countries and plans', async () => {
  const branchId = randomUUID();
  const existing = insuranceConfiguration(config());
  const countryId = randomUUID(),
    planId = randomUUID();
  const actor = {
    branchIds: [branchId],
    permissions: ['reservations.read', 'system.settings.manage'],
  } as AuthenticatedActor;
  const master = {
    list: vi.fn(async (resource: string) => ({
      data:
        resource === 'countries'
          ? [{ id: countryId, code: 'TR', name: 'Turkey' }]
          : [{ id: planId, code: '76', name: 'Festival' }],
      meta: { total: 1 },
    })),
    create: vi.fn(),
  };
  const provider = {
    configured: () => true,
    festivalRates: vi.fn(async () => [
      {
        code: 'TR',
        id: 5,
        name: 'Turkey',
        title: 'Festival',
        unsupported: 6,
        rates: [
          {
            minDays: 1,
            maxDays: 7,
            minAge: 0,
            maxAge: 12,
            amount: '399000',
            currencyCode: 'IRR',
          },
        ],
      },
    ]),
  };
  const service = new InsuranceSettingsService(
    {
      resolveSetting: async () => ({
        scope: 'BRANCH',
        scopeRef: branchId,
        value: existing,
        version: 2,
      }),
    } as never,
    master as never,
    provider as never,
  );
  vi.spyOn(service, 'read').mockResolvedValue({
    config: existing,
    version: 2,
    canManage: true,
    providerStatus: 'SANDBOX_CONFIGURED',
  });
  const save = vi
    .spyOn(service, 'save')
    .mockImplementation(async (_branch, input) => ({
      config: insuranceConfiguration((input as { config: unknown }).config),
      version: 3,
      canManage: true,
      providerStatus: 'SANDBOX_CONFIGURED',
    }));
  const result = await service.importFestival(branchId, 2, actor);
  expect(result.config.countries[0]).toEqual(existing.countries[0]);
  expect(result.config.countries[1]!.plans[0]).toMatchObject({
    masterPlanId: planId,
    providerPlanCode: '76',
    rates: [
      {
        amount: '399000',
        currencyCode: 'IRR',
        minDays: 1,
        maxDays: 7,
        minAge: 0,
        maxAge: 12,
      },
    ],
  });
  expect(result.unsupportedBands).toBe(6);
  expect(save).toHaveBeenCalledWith(
    branchId,
    expect.objectContaining({ expectedVersion: 2 }),
    actor,
  );
  expect(master.create).not.toHaveBeenCalled();
  await expect(service.importFestival(branchId, 1, actor)).rejects.toThrow();
  expect(provider.festivalRates).toHaveBeenCalledTimes(1);
});

it('allows dedicated insurance managers without granting system settings management', () => {
  const service = new InsuranceSettingsService({} as never, {} as never);
  const actor = {
    branchIds: ['branch'],
    permissions: ['reservations.read', 'reservations.insurance.manage'],
  } as AuthenticatedActor;
  expect(service.canManage(actor)).toBe(true);
  expect(actor.permissions).not.toContain('system.settings.manage');
  expect(
    service.canManage({ ...actor, permissions: ['reservations.read'] }),
  ).toBe(false);
  expect(
    service.canManage({
      ...actor,
      permissions: [
        ...actor.permissions,
        'ui.deny.field.system-settings.operations.insurance-issuance',
      ],
    }),
  ).toBe(false);
  expect(() => service.authorize(actor, 'other', true)).toThrow();
});
