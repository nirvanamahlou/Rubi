import type { AuthenticatedActor } from '@nora/contracts';
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
  roomSuite: '68888888-6888-4888-8888-688888888888',
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
  it('creates ordered real member hotels across cities and derives the legacy anchor from the first', async () => {
    const secondCity = ids.chain;
    const firstHotel = row(ids.room, { cityId: ids.city });
    const secondHotel = row(ids.roomSuite, { cityId: secondCity });
    const create = vi
      .fn()
      .mockImplementation(async (_resource, data) =>
        row(ids.facility, { ...data, members: [] }),
      );
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      create,
      find: vi
        .fn()
        .mockImplementation(async (resource, id) =>
          resource === 'hotels'
            ? ([firstHotel, secondHotel].find((hotel) => hotel.id === id) ??
              null)
            : row(id),
        ),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    await service.create(
      'composite-hotels',
      { name: 'Multicity', memberHotelIds: `${ids.roomSuite},${ids.room}` },
      actor,
    );
    expect(create.mock.calls[0]?.[1]).toMatchObject({
      cityId: secondCity,
      members: {
        create: [
          { hotelId: ids.roomSuite, priority: 1, isBackup: false },
          { hotelId: ids.room, priority: 2, isBackup: false },
        ],
      },
    });
    secondHotel.isActive = false;
    await expect(
      service.create(
        'composite-hotels',
        { name: 'Invalid', memberHotelIds: ids.roomSuite },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('edits a long imported facility without losing text and validates storage limits', async () => {
    const facility = row(ids.facility, { name: 'ف'.repeat(164) });
    const update = vi.fn().mockImplementation(async (_resource, _id, data) => ({
      ...facility,
      ...data,
      version: 2,
    }));
    const repository = {
      find: vi.fn().mockResolvedValue(facility),
      update,
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    await service.update(
      'facilities',
      ids.facility,
      { name: 'ژ'.repeat(500) },
      1,
      actor,
    );
    expect(update.mock.calls[0]?.[2]).toMatchObject({ name: 'ژ'.repeat(500) });
    for (const values of [
      { name: 'ژ'.repeat(501) },
      { englishName: 'x'.repeat(161) },
      { category: 'x'.repeat(81) },
    ])
      await expect(
        service.update('facilities', ids.facility, values, 1, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).toHaveBeenCalledTimes(1);
  });
  it('edits imported optional fields, exposes them in profiles and clears explicit blanks', async () => {
    const hotel = row(ids.chain, {
      cityId: ids.city,
      serviceLevel: 'لوکس',
      description: 'original',
    });
    const update = vi.fn().mockImplementation(async (_resource, _id, data) => ({
      ...hotel,
      ...data,
      version: 2,
    }));
    const repository = {
      find: vi.fn().mockResolvedValue(hotel),
      update,
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);
    const response = await service.update(
      'hotels',
      ids.chain,
      {
        description: 'updated',
        hotelRules: 'check-in 14:00',
        internalNote: 'new note',
        sourceRefundRules: 'reference policy',
        sourceMainImage: 'https://example.test/main.jpg',
        sourceGalleryImages:
          'https://example.test/one.jpg|https://example.test/two.jpg',
        sourceFeatured: 'false',
        freeSale: 'false',
        serviceLevel: '',
      },
      1,
      actor,
    );
    expect(response.data.attributes).toMatchObject({
      description: 'updated',
      internalNote: 'new note',
      sourceFeatured: false,
      freeSale: false,
      serviceLevel: null,
      sourceRefundRules: 'reference policy',
    });
    expect(update.mock.calls[0]?.[2]).not.toHaveProperty('sourceDestination');
    await expect(
      service.update(
        'hotels',
        ids.chain,
        { internalNote: 'a'.repeat(2001) },
        1,
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update(
        'hotels',
        ids.chain,
        { sourceFeatured: 'unknown' },
        1,
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update('hotels', ids.chain, { freeSale: 'unknown' }, 1, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).toHaveBeenCalledTimes(1);
  });
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
        roomTypeIds: `${ids.room},${ids.roomSuite}`,
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
        create: [
          { roomTypeId: ids.room, assignedByUserId: actor.userId },
          { roomTypeId: ids.roomSuite, assignedByUserId: actor.userId },
        ],
      },
      facilities: {
        create: [{ facilityId: ids.facility, assignedByUserId: actor.userId }],
      },
    });
  });

  it('creates a hotel without optional meal, room-type, or facility selections', async () => {
    const create = vi
      .fn()
      .mockImplementation(
        async (_resource: string, data: Record<string, unknown>) =>
          row('89999999-9999-4999-8999-999999999998', {
            ...data,
            mealServices: [],
            roomTypes: [],
            facilities: [],
          }),
      );
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      find: vi
        .fn()
        .mockImplementation((resource: string, id: string) =>
          resource === 'cities' && id === ids.city ? row(id) : null,
        ),
      create,
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await service.create(
      'hotels',
      {
        name: 'هتل بدون کاتالوگ اختیاری',
        cityId: ids.city,
        mealServiceIds: '',
        roomTypeIds: '',
        facilityIds: '',
      },
      actor,
    );

    expect(repository.find).toHaveBeenCalledWith('cities', ids.city);
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]?.[1]).toMatchObject({
      name: 'هتل بدون کاتالوگ اختیاری',
      cityId: ids.city,
      mealServiceId: null,
      defaultRoomTypeId: null,
      mealServices: { create: [] },
      roomTypes: { create: [] },
      facilities: { create: [] },
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
