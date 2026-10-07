import { describe, expect, it, vi } from 'vitest';

import type {
  SalesContractCreateRequest,
  SalesContractDetail,
} from '@nora/contracts';

import type { HotelPurchaseRatesPublicService } from '../reservations/hotel-purchase-rates.public';
import type {
  SalesCustomersPublicAdapter,
  SalesTicketAvailabilityPort,
} from './sales.adapters';
import type { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';

type CapacityChecks = {
  assertHotelRoomCapacity(
    input: SalesContractCreateRequest,
    branchId: string,
  ): Promise<void>;
  assertPresentedHotelRoomCapacity(
    contract: SalesContractDetail,
  ): Promise<void>;
};

function serviceWithRoomAvailability(
  roomAvailability: ReturnType<typeof vi.fn>,
) {
  return new SalesService(
    {} as SalesRepository,
    {} as SalesCustomersPublicAdapter,
    {} as SalesTicketAvailabilityPort,
    undefined,
    { roomAvailability } as unknown as HotelPurchaseRatesPublicService,
  ) as unknown as CapacityChecks;
}

describe('Sales hotel room capacity validation', () => {
  it.each([12, 17])(
    'validates under18 child age %i consistently on save and confirmation',
    async (age) => {
      const rate = {
        adults: 2,
        childAges: [{ min: 12, maxExclusive: 18 }],
        startsOn: '2026-10-01',
        endsOnExclusive: '2026-11-01',
        amount: '120.50',
        currencyCode: 'EUR',
        composition: '2 AD + 1 CHD',
        board: 'BB',
      };
      const roomAvailability = vi
        .fn()
        .mockResolvedValue({ occupancyRates: [rate] });
      const service = serviceWithRoomAvailability(roomAvailability);
      const hotelSelection = {
        hotelId: 'hotel-1',
        roomTypeId: 'room-1',
        checkInDate: '2026-10-05',
        checkOutDate: '2026-10-07',
        roomCount: 1,
        serviceClientKey: 'hotel-service',
      };
      const passengers = [
        '1990-01-01',
        '1991-01-01',
        `${2026 - age}-10-05`,
      ].map((birthDate) => ({
        birthDate,
        serviceClientKeys: ['hotel-service'],
      }));
      const input = {
        departureDate: '2026-10-05',
        hotelSelection,
        passengers,
      } as unknown as SalesContractCreateRequest;
      const contract = {
        branchId: 'branch-1',
        departureDate: '2026-10-05',
        hotelSelection,
        passengersDetail: passengers,
      } as unknown as SalesContractDetail;
      await expect(
        service.assertHotelRoomCapacity(input, 'branch-1'),
      ).resolves.toBeUndefined();
      await expect(
        service.assertPresentedHotelRoomCapacity(contract),
      ).resolves.toBeUndefined();
      roomAvailability.mockResolvedValue({
        occupancyRates: [
          { ...rate, childAges: [{ min: 2, maxExclusive: 12 }] },
        ],
      });
      await expect(
        service.assertHotelRoomCapacity(input, 'branch-1'),
      ).rejects.toMatchObject({
        response: { code: 'HOTEL_OCCUPANCY_RATE_UNAVAILABLE' },
      });
      await expect(
        service.assertPresentedHotelRoomCapacity(contract),
      ).rejects.toMatchObject({
        response: { code: 'HOTEL_OCCUPANCY_RATE_UNAVAILABLE' },
      });
      roomAvailability.mockResolvedValue({ occupancyRates: [rate] });
      passengers[2]!.birthDate = '2008-10-05';
      await expect(
        service.assertHotelRoomCapacity(input, 'branch-1'),
      ).rejects.toMatchObject({
        response: { code: 'HOTEL_OCCUPANCY_RATE_UNAVAILABLE' },
      });
      await expect(
        service.assertPresentedHotelRoomCapacity(contract),
      ).rejects.toMatchObject({
        response: { code: 'HOTEL_OCCUPANCY_RATE_UNAVAILABLE' },
      });
    },
  );
  it('allows create and update when the selected room has no active rate factor', async () => {
    const roomAvailability = vi.fn().mockResolvedValue(null);
    const service = serviceWithRoomAvailability(roomAvailability);
    const input = {
      departureDate: '2026-10-01',
      hotelSelection: {
        hotelId: 'hotel-1',
        roomTypeId: 'room-1',
        checkInDate: '2026-10-01',
        checkOutDate: '2026-10-05',
        roomCount: 1,
        serviceClientKey: 'hotel-service',
      },
      passengers: [],
    } as unknown as SalesContractCreateRequest;

    await expect(
      service.assertHotelRoomCapacity(input, 'branch-1'),
    ).resolves.toBeUndefined();
  });

  it('allows confirmation when the selected room has no active rate factor', async () => {
    const roomAvailability = vi.fn().mockResolvedValue(null);
    const service = serviceWithRoomAvailability(roomAvailability);
    const contract = {
      branchId: 'branch-1',
      hotelSelection: {
        hotelId: 'hotel-1',
        roomTypeId: 'room-1',
        checkInDate: '2026-10-01',
        checkOutDate: '2026-10-05',
        roomCount: 1,
        serviceClientKey: 'hotel-service',
      },
      passengersDetail: [],
    } as unknown as SalesContractDetail;

    await expect(
      service.assertPresentedHotelRoomCapacity(contract),
    ).resolves.toBeUndefined();
  });

  it('still rejects passenger counts above a known room capacity', async () => {
    const roomAvailability = vi.fn().mockResolvedValue({
      roomTypeName: 'دوتخته',
      maxAdults: 2,
      maxChildren: 0,
    });
    const service = serviceWithRoomAvailability(roomAvailability);
    const input = {
      departureDate: '2026-10-01',
      hotelSelection: {
        hotelId: 'hotel-1',
        roomTypeId: 'room-1',
        checkInDate: '2026-10-01',
        checkOutDate: '2026-10-05',
        roomCount: 1,
        serviceClientKey: 'hotel-service',
      },
      passengers: [
        {
          birthDate: '1990-01-01',
          serviceClientKeys: ['hotel-service'],
        },
        {
          birthDate: '1991-01-01',
          serviceClientKeys: ['hotel-service'],
        },
        {
          birthDate: '1992-01-01',
          serviceClientKeys: ['hotel-service'],
        },
      ],
    } as unknown as SalesContractCreateRequest;

    await expect(
      service.assertHotelRoomCapacity(input, 'branch-1'),
    ).rejects.toMatchObject({
      response: { code: 'HOTEL_ROOM_CAPACITY_EXCEEDED' },
    });
  });

  it('enforces the separate hotel age bands, including infant capacity', async () => {
    const roomAvailability = vi.fn().mockResolvedValue({
      roomTypeName: 'فمیلی',
      maxAdults: 2,
      maxChildren: 2,
      maxChildren2To6: 1,
      maxChildren6To12: 1,
      maxInfants: 0,
    });
    const service = serviceWithRoomAvailability(roomAvailability);
    const input = {
      departureDate: '2026-10-01',
      hotelSelection: {
        hotelId: 'hotel-1',
        roomTypeId: 'room-1',
        checkInDate: '2026-10-01',
        checkOutDate: '2026-10-05',
        roomCount: 1,
        serviceClientKey: 'hotel-service',
      },
      passengers: [
        {
          birthDate: '2025-01-01',
          serviceClientKeys: ['hotel-service'],
        },
      ],
    } as unknown as SalesContractCreateRequest;

    await expect(
      service.assertHotelRoomCapacity(input, 'branch-1'),
    ).rejects.toMatchObject({
      response: {
        code: 'HOTEL_ROOM_CAPACITY_EXCEEDED',
        requested: { infants: 1 },
      },
    });
  });
});
