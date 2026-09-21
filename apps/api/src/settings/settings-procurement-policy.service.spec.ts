import { describe, expect, it, vi } from 'vitest';

import { SettingsProcurementPolicyService } from './settings-procurement-policy.service';

describe('SettingsProcurementPolicyService', () => {
  it('resolves the newest active policy for the exact Procurement scope', async () => {
    const row = {
      id: 'policy-1',
      version: 2,
      branchId: 'branch-a',
      unitId: 'unit-a',
      category: 'OFFICE',
      currencyCode: 'IRR',
      maximumAmount: { toString: () => '1000' },
      allowUnknownEstimate: false,
      emergencyAllowed: false,
      minimumQuotations: 2,
      singleSourceAllowed: false,
      steps: [],
      approvedAt: new Date('2026-09-16T08:00:00.000Z'),
      isActive: true,
    };
    const findFirst = vi.fn().mockResolvedValue(row);
    const service = new SettingsProcurementPolicyService({
      client: { settingsProcurementApprovalPolicy: { findFirst } },
    } as never);

    await expect(
      service.resolve({
        branchId: 'branch-a',
        unitId: 'unit-a',
        category: 'OFFICE',
        currencyCode: 'IRR',
      } as never),
    ).resolves.toMatchObject({
      contract: 'settings.procurement-approval-policy.v1',
      version: 2,
      maximumAmount: '1000',
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId: 'branch-a',
          unitId: 'unit-a',
          category: 'OFFICE',
          currencyCode: 'IRR',
          isActive: true,
        },
      }),
    );
  });

  it('applies published system-management overrides to the owner policy', async () => {
    const row = {
      id: 'policy-1',
      version: 2,
      branchId: 'branch-a',
      unitId: 'unit-a',
      category: 'OFFICE',
      currencyCode: 'IRR',
      maximumAmount: { toString: () => '1000' },
      allowUnknownEstimate: false,
      emergencyAllowed: false,
      minimumQuotations: 2,
      singleSourceAllowed: false,
      steps: [],
      approvedAt: new Date('2026-09-16T08:00:00.000Z'),
      isActive: true,
    };
    const runtime = {
      json: vi
        .fn()
        .mockResolvedValueOnce({
          value: { ceiling: '2500', currency: 'IRR' },
        })
        .mockResolvedValueOnce({ value: { minimum: '4', single: true } })
        .mockResolvedValueOnce({ value: { urgent: true, unknown: true } }),
    };
    const service = new SettingsProcurementPolicyService(
      {
        client: {
          settingsProcurementApprovalPolicy: {
            findFirst: vi.fn().mockResolvedValue(row),
          },
        },
      } as never,
      runtime as never,
    );

    await expect(
      service.resolve({
        branchId: 'branch-a',
        unitId: 'unit-a',
        category: 'OFFICE',
        currencyCode: 'IRR',
      } as never),
    ).resolves.toMatchObject({
      maximumAmount: '2500',
      minimumQuotations: 4,
      singleSourceAllowed: true,
      emergencyAllowed: true,
      allowUnknownEstimate: true,
    });
    expect(runtime.json).toHaveBeenCalledTimes(3);
  });
});
