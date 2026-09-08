import type {
  AuthenticatedActor,
  FinancePartyExposurePortV1,
} from '@rubi/contracts';
import { Prisma } from '@rubi/database';
import { describe, expect, it, vi } from 'vitest';

import type { MasterOrganizationDirectory } from '../master-data/master-organization-directory';
import type { B2bRepository } from './b2b.repository';
import { B2bService } from './b2b.service';
import type { B2bAgreementDocuments } from './b2b-agreement-documents';

const organizationId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';
const actor: AuthenticatedActor = {
  userId: '33333333-3333-4333-8333-333333333333',
  sessionId: '44444444-4444-4444-8444-444444444444',
  branchIds: [branchId],
  permissions: [
    'b2b.agency.read',
    'b2b.agreement.read',
    'b2b.credit.read',
    'b2b.rate.read',
    'b2b.agency.manage',
    'b2b.agreement.manage',
    'b2b.credit.manage',
    'b2b.rate.manage',
  ],
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
  const documents = { assertDraftReference: vi.fn() };
  return {
    service: new B2bService(
      repository,
      organizations,
      exposure,
      documents as unknown as B2bAgreementDocuments,
    ),
    repository,
    organizations,
    exposure,
    documents,
  };
}

describe('B2B agency service', () => {
  it('rejects an inactive organization before writing a review profile', async () => {
    const { service, organizations, repository } = setup();
    const organization = await organizations.agencyReference(organizationId);
    vi.mocked(organizations.agencyReference).mockResolvedValue({
      ...organization!,
      isActive: false,
    });
    await expect(
      service.upsertProfile(
        organizationId,
        { branchId, status: 'UNDER_REVIEW', displayOrder: 0 },
        actor,
      ),
    ).rejects.toThrow('غیرفعال');
    expect(repository.upsertProfile).not.toHaveBeenCalled();
  });
  it('validates a document before any draft write and retains owner failures', async () => {
    const { service, documents, repository } = setup({
      id: 'profile',
      branchId,
      status: 'UNDER_REVIEW',
      isActive: true,
    });
    documents.assertDraftReference.mockRejectedValue(new Error('سند نامعتبر'));
    await expect(
      service.createAgreement(
        organizationId,
        {
          branchId,
          title: 'قرارداد آزمون',
          startsAt: '2026-09-08',
          status: 'DRAFT',
          documentReference: 'document',
        },
        actor,
      ),
    ).rejects.toThrow('سند نامعتبر');
    expect(documents.assertDraftReference).toHaveBeenCalledExactlyOnceWith(
      'document',
      organizationId,
      branchId,
      actor,
    );
    expect(repository.createAgreement).not.toHaveBeenCalled();
  });
  it('permits draft preparation under review without permitting rates or activation', async () => {
    const { service, repository } = setup({
      id: 'profile',
      branchId,
      status: 'UNDER_REVIEW',
      isActive: true,
    });
    vi.mocked(repository.createAgreement).mockRejectedValue(
      new Error('draft write reached'),
    );
    await expect(
      service.createAgreement(
        organizationId,
        {
          branchId,
          title: 'پیش‌نویس آزمون',
          startsAt: '2026-09-08',
          status: 'DRAFT',
        },
        actor,
      ),
    ).rejects.toThrow('draft write reached');
    expect(repository.createAgreement).toHaveBeenCalledOnce();
    await expect(
      service.createRate(
        organizationId,
        {
          branchId,
          title: 'نرخ آزمون',
          serviceReference: 'TEST',
          kind: 'DISCOUNT_PERCENT',
          value: '5',
          validFrom: '2026-09-08',
        },
        actor,
      ),
    ).rejects.toThrow('فعال نیست');
    expect(repository.createRate).not.toHaveBeenCalled();
    await expect(
      service.createAgreement(
        organizationId,
        {
          branchId,
          title: 'قرارداد آزمون',
          startsAt: '2026-09-08',
          status: 'ACTIVE',
        },
        actor,
      ),
    ).rejects.toThrow();
  });
  it.each(['SUSPENDED', 'ENDED'])(
    'does not permit draft agreements on %s profiles',
    async (status) => {
      const { service, repository } = setup({
        id: 'profile',
        branchId,
        status,
        isActive: true,
      });
      await expect(
        service.createAgreement(
          organizationId,
          {
            branchId,
            title: 'قرارداد آزمون',
            startsAt: '2026-09-08',
            status: 'DRAFT',
          },
          actor,
        ),
      ).rejects.toThrow('فعال نیست');
      expect(repository.createAgreement).not.toHaveBeenCalled();
    },
  );
  it('denies service calls without every required read permission before any lookup', async () => {
    const { service, organizations, repository } = setup();
    await expect(
      service.agencyWorkspace(
        organizationId,
        { ...actor, permissions: ['b2b.agency.read'] },
        branchId,
      ),
    ).rejects.toThrow('مجوز');
    expect(organizations.agencyReference).not.toHaveBeenCalled();
    expect(repository.findProfile).not.toHaveBeenCalled();
  });

  it.each(['2026-02-30', '2026-13-01', 'not-a-date'])(
    'rejects invalid calendar date %s before persistence',
    async (startsAt) => {
      const { service, repository } = setup();
      await expect(
        service.createAgreement(
          organizationId,
          { branchId, title: 'توافق آزمایشی', startsAt, status: 'DRAFT' },
          actor,
        ),
      ).rejects.toThrow('تاریخ');
      expect(repository.createAgreement).not.toHaveBeenCalled();
    },
  );

  it('does not allow direct credit writes to bypass maker/checker approval', async () => {
    const { service, repository } = setup({
      id: 'profile-id',
      branchId,
      status: 'ACTIVE',
      isActive: true,
    });
    await expect(
      service.upsertCreditPolicy(
        organizationId,
        {
          branchId,
          creditLimit: '100',
          currencyCode: 'IRR',
          effectiveFrom: '2026-09-08',
          isActive: true,
        },
        actor,
      ),
    ).rejects.toThrow('تأیید شخص دیگری');
    expect(repository.upsertCreditPolicy).not.toHaveBeenCalled();
  });

  it('does not allow a new agreement to bypass approval', async () => {
    const { service, repository } = setup();
    await expect(
      service.createAgreement(
        organizationId,
        {
          branchId,
          title: 'توافق آزمایشی',
          startsAt: '2026-09-08',
          status: 'ACTIVE',
        },
        actor,
      ),
    ).rejects.toThrow('پیش‌نویس');
    expect(repository.createAgreement).not.toHaveBeenCalled();
  });

  it('rejects mutations outside branch scope before organization lookup', async () => {
    const { service, organizations } = setup();
    await expect(
      service.upsertProfile(
        organizationId,
        { branchId: 'other', status: 'ACTIVE', displayOrder: 0 },
        actor,
      ),
    ).rejects.toThrow('دامنه دسترسی');
    expect(organizations.agencyReference).not.toHaveBeenCalled();
  });
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
      creditPolicies: [
        {
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
      ],
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
