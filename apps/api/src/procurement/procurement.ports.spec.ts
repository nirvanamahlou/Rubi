import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import type { ProcurementDraftV1 } from '@nora/contracts';
import type { SettingsProcurementPolicyService } from '../settings/settings-procurement-policy.service';
import { ProcurementPolicyPort } from './procurement.ports';

const branchId = randomUUID();
const draft = {
  branchId,
  unitId: 'unit-a',
  category: 'OFFICE',
  currencyCode: 'IRR',
} as ProcurementDraftV1;

it('fails closed without a Settings policy service or active policy', async () => {
  expect(await new ProcurementPolicyPort().resolve(draft)).toBeNull();
  const settings = {
    resolve: vi.fn().mockResolvedValue(null),
  } as unknown as SettingsProcurementPolicyService;
  expect(await new ProcurementPolicyPort(settings).resolve(draft)).toBeNull();
});

it('returns the exact versioned Settings policy as a domain policy', async () => {
  const policy = {
    contract: 'settings.procurement-approval-policy.v1' as const,
    id: randomUUID(),
    version: 2,
    approvedAt: new Date().toISOString(),
    branchId,
    unitId: 'unit-a',
    category: 'OFFICE',
    currencyCode: 'IRR',
    maximumAmount: '1000',
    allowUnknownEstimate: false,
    emergencyAllowed: false,
    minimumQuotations: 1,
    singleSourceAllowed: false,
    steps: [
      {
        userId: randomUUID(),
        maximumAmount: '1000',
        permission: 'procurement.approve' as const,
      },
    ],
    isActive: true,
  };
  const settings = {
    resolve: vi.fn().mockResolvedValue(policy),
  } as unknown as SettingsProcurementPolicyService;
  await expect(
    new ProcurementPolicyPort(settings).resolve(draft),
  ).resolves.toEqual({ ...policy, source: 'SETTINGS' });
  expect(settings.resolve).toHaveBeenCalledWith(draft);
});
