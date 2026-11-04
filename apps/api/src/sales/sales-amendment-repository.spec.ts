vi.mock('../finance/accounting/sales-contract-accounting.public', () => ({
  captureSalesContractAccounting: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../finance/accounting/accounting-workflows.public', () => ({
  assertRevenueEditable: vi.fn().mockResolvedValue(undefined),
}));
import { describe, it, expect, vi } from 'vitest';
import { SalesRepository } from './sales.repository';
import type { SalesContractCreateRequest } from '@nora/contracts';
const input = {
  customerId: 'customer',
  tripType: 'ONE_WAY',
  originId: 'a',
  destinationId: 'b',
  departureDate: '2099-01-01',
  services: [],
  passengers: [],
  priceComponents: [],
} as SalesContractCreateRequest;
function setup(count = 1) {
  const remove = { deleteMany: vi.fn() };
  const tx = {
    salesContract: {
      updateMany: vi.fn(async (_input: unknown) => {
        void _input;
        return { count };
      }),
    },
    salesContractHotelSelection: { ...remove, create: vi.fn() },
    salesContractTicketSelection: { ...remove },
    salesPassengerServiceAllocation: { ...remove, createMany: vi.fn() },
    salesContractPassenger: {
      ...remove,
      create: vi.fn(async () => ({ id: 'new-person' })),
    },
    salesContractService: {
      ...remove,
      create: vi.fn(async () => ({ id: 'hotel-service' })),
    },
    salesContractPriceComponent: { ...remove, createMany: vi.fn() },
    salesContractAuditEvent: { create: vi.fn() },
    salesReservationRequest: { create: vi.fn() },
  };
  const db = {
    client: {
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
  return { tx, repository: new SalesRepository(db as never) };
}
const amendment = {
  categories: {},
  snapshot: { version: 1 },
  requestId: 'request',
  reason: 'Synthetic',
  before: { version: 2 },
  reserve: vi.fn(async () => {}),
};
describe('contract amendment transaction', () => {
  it('persists an unknown birth date as SQL NULL with the booked category', async () => {
    const { tx, repository } = setup();
    await repository.updateDraft(
      'id',
      {
        ...input,
        passengers: [
          {
            customerId: 'person',
            displayNameSnapshot: 'Synthetic',
            birthDate: '',
            ageCategory: 'CHD',
            serviceClientKeys: [],
          },
        ],
      },
      2,
      'Synthetic',
      { userId: 'u', branchId: 'b' },
      amendment,
    );
    expect(tx.salesContractPassenger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ birthDate: null, ageCategory: 'CHD' }),
    });
  });
  it('writes the versioned outbox in the same transaction without replacing payments', async () => {
    const { tx, repository } = setup();
    await expect(
      repository.updateDraft(
        'id',
        input,
        2,
        'Synthetic',
        { userId: 'u', branchId: 'b' },
        amendment,
      ),
    ).resolves.toBe(true);
    expect(amendment.reserve).toHaveBeenCalledWith(tx);
    expect(tx.salesReservationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contractVersion: 3,
          createdByUserId: 'u',
        }),
      }),
    );
    expect(tx.salesContract.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          version: 2,
          status: { not: 'CANCELLED' },
        }),
      }),
    );
  });
  it('stale versions cannot change capacity, children or audit', async () => {
    const { tx, repository } = setup(0);
    const reserve = vi.fn();
    expect(
      await repository.updateDraft(
        'id',
        input,
        2,
        'Synthetic',
        { userId: 'u', branchId: 'b' },
        { ...amendment, reserve },
      ),
    ).toBe(false);
    expect(reserve).not.toHaveBeenCalled();
    expect(tx.salesContractService.deleteMany).not.toHaveBeenCalled();
    expect(tx.salesReservationRequest.create).not.toHaveBeenCalled();
  });
  it('capacity failure aborts before replacing contract children or emitting outbox', async () => {
    const { tx, repository } = setup();
    await expect(
      repository.updateDraft(
        'id',
        input,
        2,
        'Synthetic',
        { userId: 'u', branchId: 'b' },
        {
          ...amendment,
          reserve: async () => {
            throw Error('full');
          },
        },
      ),
    ).rejects.toThrow('full');
    expect(tx.salesContractService.deleteMany).not.toHaveBeenCalled();
    expect(tx.salesReservationRequest.create).not.toHaveBeenCalled();
  });
  it('price-only correction leaves operational queue untouched', async () => {
    const { tx, repository } = setup();
    await repository.updateDraft(
      'id',
      input,
      2,
      'Synthetic',
      { userId: 'u', branchId: 'b' },
      { ...amendment, snapshot: undefined },
    );
    expect(tx.salesReservationRequest.create).not.toHaveBeenCalled();
    expect(tx.salesContract.updateMany.mock.calls[0]?.[0]).not.toHaveProperty(
      'data.reservationStatus',
    );
  });
});

it.each([undefined, 'SINGLE' as const])(
  'persists room price and optional category %s inside the amendment transaction',
  async (roomCategory) => {
    const { repository, tx } = setup();
    const room = {
      ordinal: 1,
      roomTypeId: 'room',
      roomTypeNameSnapshot: 'Single',
      ...(roomCategory ? { roomCategory } : {}),
      adults: 1,
      childAges: [],
      agreedPrice: { amount: '125.1254', currencyCode: 'USD' },
    };
    await repository.updateDraft(
      'id',
      {
        ...input,
        services: [
          { clientKey: 'hotel', kind: 'HOTEL', titleSnapshot: 'Hotel' },
        ],
        hotelSelection: {
          serviceClientKey: 'hotel',
          hotelId: 'hotel',
          hotelNameSnapshot: 'Hotel',
          cityId: 'b',
          checkInDate: '2099-01-01',
          checkOutDate: '2099-01-03',
          roomCount: 1,
          roomTypeId: 'room',
          occupancy: 1,
          inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
          rooms: [room],
        },
      },
      2,
      'Synthetic',
      { userId: 'u', branchId: 'b' },
      amendment,
    );
    expect(tx.salesContractHotelSelection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rooms: { create: [room] } }),
      }),
    );
  },
);

it('persists the room occupancy summary from products rather than stale submitted totals', async () => {
  const { tx, repository } = setup();
  const rooms = [
    {
      ordinal: 1,
      roomTypeId: 'a',
      roomTypeNameSnapshot: 'Single',
      adults: 1,
      childAges: [],
    },
    {
      ordinal: 2,
      roomTypeId: 'b',
      roomTypeNameSnapshot: 'Family',
      adults: 2,
      childAges: [6, 8],
    },
  ];
  await repository.updateDraft(
    'id',
    {
      ...input,
      services: [
        {
          clientKey: 'hotel',
          kind: 'HOTEL',
          titleSnapshot: 'Hotel',
        },
      ],
      hotelSelection: {
        serviceClientKey: 'hotel',
        hotelId: 'h',
        hotelNameSnapshot: 'Hotel',
        cityId: 'city',
        checkInDate: '2099-01-01',
        checkOutDate: '2099-01-03',
        roomCount: 2,
        singleRoomCount: 2,
        doubleRoomCount: 0,
        extraBedCount: 0,
        roomTypeId: 'a',
        occupancy: 5,
        inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
        rooms,
      },
    },
    2,
    'Synthetic',
    { userId: 'u', branchId: 'b' },
    amendment,
  );
  expect(tx.salesContractHotelSelection.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        roomCount: 2,
        singleRoomCount: 1,
        doubleRoomCount: 1,
        extraBedCount: 2,
        occupancy: 5,
      }),
    }),
  );
});

vi.mock('./sales-financial-settlement', () => ({
  recalculateSalesSettlement: vi.fn().mockResolvedValue(undefined),
}));

it('persists independent additional stays in the hotel transaction without adding charged services', async () => {
  const { tx, repository } = setup();
  const additionalStays = [
    {
      hotelId: 'hotel-two',
      cityId: 'city-two',
      hotelNameSnapshot: 'Second Hotel',
      rooms: [
        {
          ordinal: 1,
          roomTypeId: 'second-room',
          roomTypeNameSnapshot: 'Suite',
          adults: 2,
          childAges: [5],
          roomCategory: 'DOUBLE_EXTRA' as const,
        },
      ],
      checkInDate: '2099-01-03',
      checkOutDate: '2099-01-06',
    },
  ];
  await repository.updateDraft(
    'id',
    {
      ...input,
      services: [{ clientKey: 'hotel', kind: 'HOTEL', titleSnapshot: 'Hotel' }],
      hotelSelection: {
        serviceClientKey: 'hotel',
        hotelId: 'first',
        hotelNameSnapshot: 'First',
        cityId: 'first-city',
        checkInDate: '2099-01-01',
        checkOutDate: '2099-01-03',
        roomCount: 1,
        roomTypeId: 'room',
        occupancy: 1,
        inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
        additionalStays,
      },
    },
    2,
    'Synthetic',
    { userId: 'u', branchId: 'b' },
    amendment,
  );
  expect(tx.salesContractHotelSelection.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        additionalStays: {
          create: [
            {
              ...additionalStays[0],
              rooms: { create: additionalStays[0]!.rooms },
              ordinal: 2,
              checkInDate: new Date('2099-01-03T00:00:00.000Z'),
              checkOutDate: new Date('2099-01-06T00:00:00.000Z'),
            },
          ],
        },
      }),
    }),
  );
  expect(tx.salesContractService.create).toHaveBeenCalledTimes(1);
  expect(tx.salesContractPriceComponent.createMany).toHaveBeenCalledWith({
    data: [],
  });
});
