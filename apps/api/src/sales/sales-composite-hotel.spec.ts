import { expect, it, vi } from 'vitest';
import type { SalesContractCreateRequest } from '@nora/contracts';
import { SalesService } from './sales.service';

it('validates itinerary hotels through the Master Data owner without rewriting snapshots or historical references', async () => {
  const detail = vi.fn(async (_resource, id) => ({
    data: {
      id,
      status: 'active',
      name: id === 'first' ? 'First' : 'Second',
      attributes: {
        cityId: id === 'first' ? 'city-one' : 'city-two',
        isSaleableReference: true,
      },
    },
  }));
  const service = new SalesService(
    {} as never,
    {} as never,
    {} as never,
    undefined,
    undefined,
    undefined,
    { detail } as never,
  ) as unknown as {
    assertAdditionalHotelStays(
      input: SalesContractCreateRequest,
      existing?: SalesContractCreateRequest['hotelSelection'],
    ): Promise<void>;
  };
  const hotelSelection = {
    hotelId: 'first',
    cityId: 'city-one',
    hotelNameSnapshot: 'First',
    checkInDate: '2099-01-01',
    checkOutDate: '2099-01-03',
    additionalStays: [
      {
        hotelId: 'second',
        cityId: 'city-two',
        hotelNameSnapshot: 'Second',
        checkInDate: '2099-01-03',
        checkOutDate: '2099-01-06',
      },
    ],
  };
  const input = {
    services: [],
    hotelSelection,
  } as unknown as SalesContractCreateRequest;
  const before = structuredClone(input);
  await service.assertAdditionalHotelStays(input);
  expect(detail).toHaveBeenCalledTimes(2);
  expect(input).toEqual(before);
  detail.mockClear();
  await service.assertAdditionalHotelStays(input, input.hotelSelection);
  expect(detail).not.toHaveBeenCalled();
  hotelSelection.additionalStays[0]!.cityId = 'wrong-city';
  await expect(service.assertAdditionalHotelStays(input)).rejects.toThrow(
    'Invalid hotel itinerary',
  );
});

it('rejects an additional hotel room type belonging to another hotel, including changes on an existing itinerary', async () => {
  const detail = vi.fn(async (resource: string, id: string) => ({
    data:
      resource === 'hotels'
        ? {
            id,
            status: 'active',
            name: id,
            attributes: {
              cityId: id + '-city',
              roomTypeIds: id === 'second' ? 'suite' : 'single',
            },
          }
        : { id, status: 'active', name: id, attributes: {} },
  }));
  const service = new SalesService(
    {} as never,
    {} as never,
    {} as never,
    undefined,
    undefined,
    undefined,
    { detail } as never,
  ) as unknown as {
    assertAdditionalHotelStays(
      input: SalesContractCreateRequest,
      previous?: SalesContractCreateRequest['hotelSelection'],
    ): Promise<void>;
  };
  const hotelSelection = {
    hotelId: 'first',
    cityId: 'first-city',
    hotelNameSnapshot: 'first',
    checkInDate: '2099-01-01',
    checkOutDate: '2099-01-03',
    additionalStays: [
      {
        hotelId: 'second',
        cityId: 'second-city',
        hotelNameSnapshot: 'second',
        checkInDate: '2099-01-03',
        checkOutDate: '2099-01-06',
        rooms: [
          {
            ordinal: 1,
            roomTypeId: 'suite',
            roomTypeNameSnapshot: 'suite',
            adults: 2,
            childAges: [],
          },
        ],
      },
    ],
  };
  const input = {
    services: [],
    hotelSelection,
  } as unknown as SalesContractCreateRequest;
  await expect(
    service.assertAdditionalHotelStays(input),
  ).resolves.toBeUndefined();
  const previous = structuredClone(input.hotelSelection);
  hotelSelection.additionalStays[0]!.rooms[0]!.roomTypeId = 'single';
  hotelSelection.additionalStays[0]!.rooms[0]!.roomTypeNameSnapshot = 'single';
  await expect(
    service.assertAdditionalHotelStays(input, previous),
  ).rejects.toThrow('نوع اتاق');
});
