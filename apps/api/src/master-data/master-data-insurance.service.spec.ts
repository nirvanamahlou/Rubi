import { BadRequestException } from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { MasterDataRepository } from './master-data.repository';
import { MasterDataService } from './master-data.service';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '99999999-9999-4999-8999-999999999999',
  branchIds: ['22222222-2222-4222-8222-222222222222'],
  permissions: ['master_data.create', 'master_data.read'],
};

const ids = {
  insurer: '33333333-3333-4333-8333-333333333333',
  coverage: '44444444-4444-4444-8444-444444444444',
  currency: '55555555-5555-4555-8555-555555555555',
};

function row(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    code: 'REFERENCE',
    name: 'مرجع آزمون',
    isActive: true,
    version: 1,
    createdAt: new Date('2026-08-29T00:00:00.000Z'),
    updatedAt: new Date('2026-08-29T00:00:00.000Z'),
    ...extra,
  };
}

describe('MasterDataService insurance', () => {
  it('persists plan coverage membership as a normalized relation', async () => {
    const create = vi
      .fn()
      .mockImplementation(
        async (_resource: string, data: Record<string, unknown>) => {
          const relation = data.coverages as {
            create: { coverageId: string }[];
          };
          return row('66666666-6666-4666-8666-666666666666', {
            ...data,
            coverages: relation.create.map(({ coverageId }) => ({
              coverage: row(coverageId),
            })),
            insurer: row(ids.insurer),
          });
        },
      );
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      find: vi.fn().mockImplementation((resource: string, id: string) => {
        if (resource === 'insurers' && id === ids.insurer) return row(id);
        if (resource === 'insurance-coverages' && id === ids.coverage)
          return row(id);
        return null;
      }),
      create,
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await service.create(
      'insurance-plans',
      {
        name: 'طرح آزمایشی',
        insurerId: ids.insurer,
        destinationRegion: 'منطقه آزمایشی',
        minimumAge: 0,
        maximumAge: 65,
        validFrom: '2026-09-01T00:00:00.000Z',
        validTo: '2027-09-01T00:00:00.000Z',
        coverageIds: ids.coverage,
      },
      actor,
    );

    expect(create.mock.calls[0]?.[1]).toMatchObject({
      insurerId: ids.insurer,
      minimumAge: 0,
      maximumAge: 65,
      coverages: {
        create: [{ coverageId: ids.coverage, assignedByUserId: actor.userId }],
      },
    });
    expect(create.mock.calls[0]?.[1]).not.toHaveProperty('coverageIds');
  });

  it('rejects an invalid coverage amount before persistence', async () => {
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      create: vi.fn(),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await expect(
      service.create(
        'insurance-coverages',
        {
          name: 'پوشش آزمایشی',
          currencyId: ids.currency,
          coverageLimit: '100.00000000000',
          deductibleAmount: '0',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a plan with a reversed validity or age range', async () => {
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      create: vi.fn(),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await expect(
      service.create(
        'insurance-plans',
        {
          name: 'طرح نامعتبر',
          insurerId: ids.insurer,
          destinationRegion: 'منطقه آزمایشی',
          minimumAge: 70,
          maximumAge: 20,
          validFrom: '2027-09-01T00:00:00.000Z',
          validTo: '2026-09-01T00:00:00.000Z',
          coverageIds: ids.coverage,
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('returns the real repository summary without mockup KPI values', async () => {
    const summary = {
      insurers: { total: 0, active: 0, countries: 0, missingLogo: 0 },
      plans: { total: 0, active: 0, expiringSoon: 0, destinations: 0 },
      coverages: { total: 0, active: 0, currencies: 0, needsReview: 0 },
    };
    const repository = {
      insuranceSummary: vi.fn().mockResolvedValue(summary),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await expect(service.insuranceSummary()).resolves.toEqual({
      data: summary,
    });
  });
});
