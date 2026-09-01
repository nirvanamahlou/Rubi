import { describe, expect, it } from 'vitest';

import { toMasterDataRecord } from './master-data.repository';

const base = {
  isActive: true,
  version: 3,
  createdAt: new Date('2026-08-29T00:00:00.000Z'),
  updatedAt: new Date('2026-08-29T01:00:00.000Z'),
};

describe('accommodation record mapping', () => {
  it('maps hotel location and normalized catalogs for the public API', () => {
    const record = toMasterDataRecord('hotels', {
      ...base,
      id: '11111111-1111-4111-8111-111111111111',
      code: 'HOTEL_A',
      name: 'هتل الف',
      city: {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'تهران',
        countryId: '33333333-3333-4333-8333-333333333333',
        country: { name: 'ایران' },
        region: { name: 'استان تهران' },
      },
      chain: { id: '4', code: 'CHAIN_A', name: 'زنجیره الف' },
      facilities: [{ facility: { id: '5', code: 'WIFI', name: 'اینترنت' } }],
      mealServices: [{ mealService: { id: '6', code: 'BB', name: 'صبحانه' } }],
      roomTypes: [{ roomType: { id: '7', code: 'DBL', name: 'دونفره' } }],
    });

    expect(record.attributes).toMatchObject({
      cityName: 'تهران',
      countryName: 'ایران',
      regionName: 'استان تهران',
      chainName: 'زنجیره الف',
      facilityCodes: 'WIFI',
      mealServiceCodes: 'BB',
      roomTypeCodes: 'DBL',
    });
  });

  it('publishes composite members by priority without contract data', () => {
    const record = toMasterDataRecord('composite-hotels', {
      ...base,
      id: '88888888-8888-4888-8888-888888888888',
      code: 'COMPOSITE_A',
      name: 'هتل ترکیبی الف',
      city: { name: 'استانبول', countryId: '9', country: { name: 'ترکیه' } },
      members: [
        {
          priority: 1,
          isBackup: false,
          hotel: {
            id: '10',
            code: 'HTL_1',
            name: 'هتل یک',
            city: { name: 'استانبول' },
          },
        },
      ],
    });

    expect(record.attributes).toMatchObject({
      memberHotelCodes: 'HTL_1',
      memberPriorities: '1',
      memberCount: 1,
    });
    expect(record.attributes).not.toHaveProperty('contractReference');
  });
});
