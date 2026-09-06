import type {
  AuthenticatedActor,
  FinancePartyExposurePortV1,
} from '@rubi/contracts';
import { Prisma } from '@rubi/database';
import { describe, expect, it, vi } from 'vitest';

import type { MasterOrganizationDirectory } from '../master-data/master-organization-directory';
import type { B2bRepository } from './b2b.repository';
import { B2bService } from './b2b.service';

const organizationId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';
const actor: AuthenticatedActor = {
  userId: '33333333-3333-4333-8333-333333333333',
  sessionId: '44444444-4444-4444-8444-444444444444',
  branchIds: [branchId],
  permissions: ['b2b.agency.read'],
};

function setup(profile: Record<string, unknown> | null = null) {
  const organizations = {
    agencyReference: vi.fn().mockResolvedValue({
      id: organizationId,
      code: 'AGENCY-1',
      legalName: 'آژانس آزمون',
      displayName: 'آژانس آزمون',
      personType: 'LEGAL',
      logoFileReference: null,
      isActive: true,
      version: 1,
    }),
    primaryAddress: vi.fn().mockResolvedValue(null),
  } as unknown as MasterOrganizationDirectory;
  const repository = {
    findProfile: vi.fn().mockResolvedValue(profile),
    upsertProfile: vi.fn(),
    createAgreement: vi.fn(),
    upsertCreditPolicy: vi.fn(),
    createRate: vi.fn(),
  } as unknown as B2bRepository;
  const exposure = {
    getPartyExposure: vi.fn().mockResolvedValue({
      status: 'UNAVAILABLE',
      reason: 'FINANCE_PORT_UNAVAILABLE',
    }),
  } as unknown as FinancePartyExposurePortV1;
  return {
    service: new B2bService(repository, organizations, exposure),
    repository,
    organizations,
    exposure,
  };
}

describe('B2B agency service', () => {
  it('returns no fabricated exposure when the agency has no credit policy', async () => {
    const { service, exposure } = setup();
    const result = await service.agencyWorkspace(
      organizationId,
      actor,
      branchId,
    );
    expect(result.data.profile).toBeNull();
    expect(result.data.financeExposure).toEqual({
      status: 'UNAVAILABLE',
      reason: 'NO_EXPOSURE_SNAPSHOT',
    });
    expect(exposure.getPartyExposure).not.toHaveBeenCalled();
  });

  it('queries Finance through the public exposure port when a policy exists', async () => {
    const now = new Date('2026-09-05T10:00:00.000Z');
    const { service, exposure } = setup({
      id: '55555555-5555-4555-8555-555555555555',
      organizationId,
      branchId,
      accountManagerUserId: null,
      status: 'ACTIVE',
      displayOrder: 0,
      isActive: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
      agreements: [],
      agreedRates: [],
      creditPolicy: {
        id: '66666666-6666-4666-8666-666666666666',
        profileId: '55555555-5555-4555-8555-555555555555',
        creditLimit: new Prisma.Decimal('250000000'),
        currencyCode: 'IRR',
        effectiveFrom: now,
        expiresAt: null,
        isActive: true,
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    });
    await service.agencyWorkspace(organizationId, actor, branchId);
    expect(exposure.getPartyExposure).toHaveBeenCalledWith({
      organizationId,
      branchId,
      currencyCode: 'IRR',
    });
  });

  it('rejects branch access outside the authenticated actor scope', async () => {
    const { service } = setup();
    await expect(
      service.agencyWorkspace(
        organizationId,
        actor,
        '99999999-9999-4999-8999-999999999999',
      ),
    ).rejects.toThrow('دامنه دسترسی');
  });

  it('enforces fixed-amount currency and percentage bounds before persistence', async () => {
    const { service, repository } = setup({ id: 'profile-id', branchId });
    await expect(
      service.createRate(
        organizationId,
        {
          branchId,
          serviceReference: 'HOTEL',
          title: 'مبلغ توافقی',
          kind: 'FIXED_AMOUNT',
          value: '1000',
          validFrom: '2026-09-05',
        },
        actor,
      ),
    ).rejects.toThrow('ارز');
    await expect(
      service.createRate(
        organizationId,
        {
          branchId,
          serviceReference: 'HOTEL',
          title: 'تخفیف توافقی',
          kind: 'DISCOUNT_PERCENT',
          value: '101',
          validFrom: '2026-09-05',
        },
        actor,
      ),
    ).rejects.toThrow('۱۰۰');
    expect(repository.createRate).not.toHaveBeenCalled();
  });
});
