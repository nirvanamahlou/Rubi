import type { DatabaseService } from '../database/database.service';
import { describe, expect, it, vi } from 'vitest';

import {
  MasterDataRepository,
  toMasterDataRecord,
} from './master-data.repository';

describe('MasterDataRepository travel services', () => {
  it('filters CIP services by airport and includes provider references', async () => {
    const airportId = '11111111-1111-4111-8111-111111111111';
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const database = {
      client: { masterCipService: { findMany, count } },
    } as unknown as DatabaseService;
    const repository = new MasterDataRepository(database);

    await repository.list('cip-services', {
      search: '',
      status: 'active',
      airportId,
      sortBy: 'name',
      sortDirection: 'asc',
      page: 1,
      pageSize: 25,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, airportId },
        include: {
          airport: { include: { city: true } },
          supplier: { include: { organization: true } },
        },
      }),
    );
  });

  it('maps a leader location and masked contacts without encrypted PII', () => {
    const record = toMasterDataRecord('leaders', {
      id: '22222222-2222-4222-8222-222222222222',
      cityId: '33333333-3333-4333-8333-333333333333',
      code: 'LEADER_TEST',
      name: 'لیدر آزمون',
      languages: ['فارسی'],
      destinations: ['تهران'],
      primaryPhoneEncrypted: 'encrypted-value',
      primaryPhoneMasked: '+98••••1234',
      isActive: true,
      version: 1,
      createdAt: new Date('2026-08-29T00:00:00.000Z'),
      updatedAt: new Date('2026-08-29T00:00:00.000Z'),
      city: {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'تهران',
        countryId: '44444444-4444-4444-8444-444444444444',
        country: { name: 'ایران' },
      },
    });

    expect(record.attributes).toMatchObject({
      cityName: 'تهران',
      countryName: 'ایران',
      primaryPhoneMasked: '+98••••1234',
    });
    expect(record.attributes).not.toHaveProperty('primaryPhoneEncrypted');
  });

  it('maps normalized bus facilities and provider linkage for the popup profile', () => {
    const record = toMasterDataRecord('bus-types', {
      id: '55555555-5555-4555-8555-555555555555',
      code: 'BUS_TYPE_TEST',
      name: 'اتوبوس آزمون',
      serviceClass: 'VIP',
      amenities: [],
      isActive: true,
      version: 1,
      createdAt: new Date('2026-08-29T00:00:00.000Z'),
      updatedAt: new Date('2026-08-29T00:00:00.000Z'),
      facilities: [
        {
          facility: {
            id: '66666666-6666-4666-8666-666666666666',
            code: 'FAC_TEST',
            name: 'مانیتور',
          },
        },
      ],
    });

    expect(record.attributes).toMatchObject({
      facilityIds: '66666666-6666-4666-8666-666666666666',
      facilityNames: 'مانیتور',
    });
  });
});
