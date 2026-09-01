import type { AuthenticatedActor } from '@rubi/contracts';
import { BadRequestException } from '@nestjs/common';
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
  city: '33333333-3333-4333-8333-333333333333',
  chain: '44444444-4444-4444-8444-444444444444',
  meal: '55555555-5555-4555-8555-555555555555',
  room: '66666666-6666-4666-8666-666666666666',
  facility: '77777777-7777-4777-8777-777777777777',
};

function row(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    code: 'REFERENCE',
    name: 'مرجع',
    isActive: true,
    isSaleableReference: true,
    version: 1,
    createdAt: new Date('2026-08-29T00:00:00.000Z'),
    updatedAt: new Date('2026-08-29T00:00:00.000Z'),
    ...extra,
  };
}

describe('MasterDataService accommodation', () => {
  it('persists hotel catalogs as normalized relations', async () => {
    const create = vi
      .fn()
      .mockImplementation(
        async (
          _resource: string,
          data: Record<string, unknown>,
          _userId: string,
          _branchId: string,
        ) => {
          void _resource;
          void _userId;
          void _branchId;
          const mealWrites = data.mealServices as {
            create?: { mealServiceId: string }[];
          };
          const roomWrites = data.roomTypes as {
            create?: { roomTypeId: string }[];
          };
          const facilityWrites = data.facilities as {
            create?: { facilityId: string }[];
          };
          return row('88888888-8888-4888-8888-888888888888', {
            ...data,
            cityId: ids.city,
            city: { id: ids.city, name: 'تهران', countryId: ids.city },
            mealServices: (mealWrites.create ?? []).map(
              ({ mealServiceId }) => ({
                mealService: row(mealServiceId),
              }),
            ),
            roomTypes: (roomWrites.create ?? []).map(({ roomTypeId }) => ({
              roomType: row(roomTypeId),
            })),
            facilities: (facilityWrites.create ?? []).map(({ facilityId }) => ({
              facility: row(facilityId),
            })),
          });
        },
      );
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      find: vi.fn().mockImplementation((resource: string, id: string) => {
        if (resource === 'cities' && id === ids.city) return row(id);
        if (resource === 'hotel-chains' && id === ids.chain) return row(id);
        if (['meal-services', 'room-types', 'facilities'].includes(resource))
          return row(id);
        return null;
      }),
      create,
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await service.create(
      'hotels',
      {
        name: 'هتل آزمون',
        englishName: 'Test Hotel',
        cityId: ids.city,
        chainId: ids.chain,
        mealServiceIds: ids.meal,
        roomTypeIds: ids.room,
        facilityIds: ids.facility,
        isSaleableReference: 'true',
      },
      actor,
    );

    const persisted = create.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(persisted).not.toHaveProperty('mealServiceIds');
    expect(persisted).not.toHaveProperty('roomTypeIds');
    expect(persisted).not.toHaveProperty('facilityIds');
    expect(persisted).toMatchObject({
      mealServiceId: ids.meal,
      defaultRoomTypeId: ids.room,
      isSaleableReference: true,
      mealServices: {
        create: [{ mealServiceId: ids.meal, assignedByUserId: actor.userId }],
      },
      roomTypes: {
        create: [{ roomTypeId: ids.room, assignedByUserId: actor.userId }],
      },
      facilities: {
        create: [{ facilityId: ids.facility, assignedByUserId: actor.userId }],
      },
    });
  });

  it('rejects an incomplete coordinate pair before persistence', async () => {
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      create: vi.fn(),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await expect(
      service.create(
        'hotels',
        { name: 'هتل آزمون', cityId: ids.city, latitude: '35.7' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('normalizes blank optional catalog fields instead of storing empty text', async () => {
    const create = vi
      .fn()
      .mockImplementation(
        async (_resource: string, data: Record<string, unknown>) =>
          row('89999999-9999-4999-8999-999999999999', data),
      );
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      create,
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await service.create(
      'room-types',
      {
        name: 'اتاق آزمایشی',
        englishName: '',
        referenceCapacity: '',
        usageDescription: '',
      },
      actor,
    );

    expect(create.mock.calls[0]?.[1]).toMatchObject({
      englishName: null,
      referenceCapacity: null,
      usageDescription: null,
    });
  });

  it('returns the real repository summary without sample KPI values', async () => {
    const summary = {
      hotels: { total: 0, saleable: 0, countries: 0, cities: 0, incomplete: 0 },
      chains: { total: 0, active: 0, memberHotels: 0, incomplete: 0 },
      roomTypes: {
        total: 0,
        active: 0,
        standardCapacity: 0,
        pendingDomainApproval: 0,
      },
      mealServices: { total: 0, active: 0, mealPlans: 0, needsReview: 0 },
      facilities: { total: 0, active: 0, categories: 0, missingIcon: 0 },
      compositeHotels: {
        total: 0,
        active: 0,
        uniqueMemberHotels: 0,
        needsReview: 0,
      },
    };
    const repository = {
      accommodationSummary: vi.fn().mockResolvedValue(summary),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await expect(service.accommodationSummary()).resolves.toEqual({
      data: summary,
    });
  });
});
