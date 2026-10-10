import type { DatabaseService } from '../database/database.service';
import { describe, expect, it, vi } from 'vitest';

import {
  MasterDataRepository,
  toMasterDataRecord,
} from './master-data.repository';

describe('MasterDataRepository insurance', () => {
  it('filters plans by insurer and exposes normalized coverage labels', async () => {
    const insurerId = '11111111-1111-4111-8111-111111111111';
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const database = {
      client: { masterInsurancePlan: { findMany, count } },
    } as unknown as DatabaseService;
    const repository = new MasterDataRepository(database);

    await repository.list('insurance-plans', {
      search: 'سفر',
      status: 'active',
      insurerId,
      sortBy: 'name',
      sortDirection: 'asc',
      page: 1,
      pageSize: 25,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true, insurerId }),
        include: {
          insurer: true,
          coverages: { include: { coverage: true } },
        },
      }),
    );
  });

  it('maps plan and coverage relations without leaking implementation rows', () => {
    const plan = toMasterDataRecord('insurance-plans', {
      id: '22222222-2222-4222-8222-222222222222',
      insurerId: '11111111-1111-4111-8111-111111111111',
      code: 'INS_PLAN_TEST',
      name: 'طرح آزمون',
      destinationRegion: 'آزمون',
      minimumAge: 0,
      maximumAge: 65,
      validFrom: new Date('2026-09-01T00:00:00.000Z'),
      validTo: null,
      isActive: true,
      version: 1,
      createdAt: new Date('2026-08-29T00:00:00.000Z'),
      updatedAt: new Date('2026-08-29T00:00:00.000Z'),
      insurer: { code: 'INS_TEST', name: 'بیمه آزمون' },
      coverages: [
        {
          coverage: {
            id: '33333333-3333-4333-8333-333333333333',
            code: 'COVER_TEST',
            name: 'پوشش آزمون',
          },
        },
      ],
    });

    expect(plan.attributes).toMatchObject({
      insurerName: 'بیمه آزمون',
      coverageCodes: 'COVER_TEST',
      coverageNames: 'پوشش آزمون',
      coverageCount: 1,
    });
    expect(plan.attributes).not.toHaveProperty('coverages');
  });
});
