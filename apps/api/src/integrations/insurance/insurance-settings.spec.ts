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
