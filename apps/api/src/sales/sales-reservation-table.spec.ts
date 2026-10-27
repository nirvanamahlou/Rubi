import { it, expect, vi } from 'vitest';
import { Prisma } from '@nora/database';
import { SalesReservationTableService } from './sales-reservation-table.module';
const decimal = (n: string) => new Prisma.Decimal(n);
function setup() {
  const record = {
    id: 'c',
    version: 5,
    status: 'CANCELLED',
    cancelledAt: new Date('2026-09-30T10:00:00Z'),
    createdAt: new Date('2026-09-01T10:00:00Z'),
    departureDate: new Date('2026-10-01'),
    returnNotBefore: new Date('2026-10-03'),
    hotelSelection: null,
    ticketSelections: [],
    auditEvents: [{ occurredAt: new Date('2026-09-20T10:00:00Z') }],
    passengers: ['2025-10-01', '2024-10-01', '2020-10-01', '2014-10-01'].map(
      (d) => ({ birthDate: new Date(d) }),
    ),
    priceComponents: [
      {
        type: 'BASE',
        title: 'Rial',
        currencyCode: 'IRR',
        amount: decimal('1000'),
      },
      {
        type: 'DISCOUNT',
        title: 'Discount',
        currencyCode: 'IRR',
        amount: decimal('100'),
      },
      {
        type: 'BASE',
        title: 'USD',
        currencyCode: 'USD',
        amount: decimal('200'),
      },
    ],
    payments: [
      {
        status: 'FINANCE_CONFIRMED',
        currencyCode: 'IRR',
        amount: decimal('300'),
      },
      {
        status: 'PENDING_FINANCE_CONFIRMATION',
        currencyCode: 'USD',
        amount: decimal('20'),
      },
    ],
  };
  const findMany = vi.fn().mockResolvedValue([record]);
  const tickets = { reservationCommissions: vi.fn().mockResolvedValue([]) };
  return {
    record,
    findMany,
    tickets,
    service: new SalesReservationTableService(
      { client: { salesContract: { findMany } } } as never,
      tickets as never,
    ),
  };
}
it('reads completed name-only passengers without manufacturing ages or crashing', async () => {
  const s = setup();
  s.findMany.mockResolvedValueOnce([
    {
      ...s.record,
      passengers: [
        {
          birthDate: null,
          ageCategory: 'ADT',
          displayNameSnapshot: 'SYNTHETIC ADULT',
        },
        { birthDate: null, ageCategory: 'INF' },
        { birthDate: null, ageCategory: 'CHD' },
      ],
    },
  ]);
  const result = await s.service.read(['c'], {
    permissions: ['reservations.read'],
    branchIds: ['b'],
  } as never);
  expect(result.get('c')).toMatchObject({
    passengerCount: 3,
    passengerNames: ['SYNTHETIC ADULT'],
    adults: 1,
    infants: 1,
    children2To6: 0,
    children6To12: 0,
  });
});
it('keeps currency balances separate, finance-confirmed debt and exact age boundaries', async () => {
  const s = setup();
  const result = await s.service.read(['c'], {
    permissions: ['reservations.read', 'sales.payments.read'],
    branchIds: ['b'],
  } as never);
  expect(result.get('c')).toMatchObject({
    saleRial: '900',
    saleForeign: '200 USD',
    debtRial: '600',
    debtForeign: '200 USD',
    adults: 1,
    children6To12: 1,
    children2To6: 1,
    infants: 1,
    passengerCount: 4,
    returnDate: null,
  });
  expect(s.findMany.mock.calls[0]?.[0].where.branchId).toEqual({ in: ['b'] });
});
it('does not project debt without financial permission or query without reservation permission', async () => {
  const s = setup();
  expect(
    (
      await s.service.read(['c'], {
        permissions: ['reservations.read'],
        branchIds: ['b'],
      } as never)
    ).get('c')?.debtRial,
  ).toBeNull();
  s.findMany.mockClear();
  expect(
    (
      await s.service.read(['c'], {
        permissions: [],
        branchIds: ['b'],
      } as never)
    ).size,
  ).toBe(0);
  expect(s.findMany).not.toHaveBeenCalled();
});

it('projects ages only for the matching hotel contract and allocated guests', async () => {
  const hotel = {
    hotelId: 'hotel',
    roomTypeId: 'room',
    roomCount: 1,
    mealServiceId: null,
    singleRoomCount: 0,
    doubleRoomCount: 1,
    extraBedCount: 0,
    checkInDate: new Date('2026-10-01'),
    checkOutDate: new Date('2026-10-03'),
  };
  const row = {
    hotelSelection: hotel,
    passengers: [
      {
        customerId: 'guest',
        birthDate: new Date('1990-10-02'),
        allocations: [{ service: { clientKey: 'hotel-service' } }],
      },
    ],
  };
  const findFirst = vi.fn().mockResolvedValue(row);
  const service = new SalesReservationTableService(
    { client: { salesContract: { findFirst } } } as never,
    {} as never,
  );
  const snapshot = {
    contractId: 'contract',
    hotelSelection: {
      ...hotel,
      mealServiceId: undefined,
      serviceClientKey: 'hotel-service',
      checkInDate: '2026-10-01',
      checkOutDate: '2026-10-03',
    },
    passengerAssignments: [
      { customerId: 'guest', serviceClientKeys: ['hotel-service'] },
    ],
  } as never;
  const actor = {
    permissions: ['reservations.read'],
    branchIds: ['branch'],
  } as never;
  expect(await service.hotelGuestAges(snapshot, actor)).toEqual([35]);
  expect(findFirst.mock.calls[0]![0].where).toMatchObject({
    branchId: { in: ['branch'] },
    status: { not: 'CANCELLED' },
  });
  row.passengers[0]!.customerId = 'other';
  expect(await service.hotelGuestAges(snapshot, actor)).toBeNull();
  row.passengers[0]!.customerId = 'guest';
  hotel.roomCount = 2;
  expect(await service.hotelGuestAges(snapshot, actor)).toBeNull();
});

it('uses successful sales corrections and historical completions for the correction marker', async () => {
  const s = setup();
  await s.service.read(['c'], {
    permissions: ['reservations.read'],
    branchIds: ['b'],
  } as never);
  expect(s.findMany.mock.calls[0]![0].include.auditEvents.where).toEqual({
    outcome: 'SUCCESS',
    action: {
      in: ['SALES_PASSENGER_CORRECTION', 'SALES_PASSENGER_COMPLETION'],
    },
  });
});

it('matches unchanged room products even when old stored counts differ from their canonical summary', async () => {
  const rooms = [
    {
      ordinal: 1,
      roomTypeId: 'room',
      roomTypeNameSnapshot: 'Family',
      adults: 2,
      childAges: [6],
    },
  ];
  const hotel = {
    hotelId: 'hotel',
    roomTypeId: 'room',
    roomCount: 1,
    mealServiceId: null,
    singleRoomCount: 0,
    doubleRoomCount: 1,
    extraBedCount: 0,
    rooms,
    checkInDate: new Date('2026-10-01'),
    checkOutDate: new Date('2026-10-03'),
  };
  const row = {
    hotelSelection: hotel,
    passengers: [
      {
        customerId: 'guest',
        birthDate: new Date('1990-10-02'),
        allocations: [{ service: { clientKey: 'hotel-service' } }],
      },
    ],
  };
  const service = new SalesReservationTableService(
    {
      client: { salesContract: { findFirst: vi.fn().mockResolvedValue(row) } },
    } as never,
    {} as never,
  );
  const snapshot = {
    contractId: 'contract',
    hotelSelection: {
      ...hotel,
      rooms: structuredClone(rooms),
      extraBedCount: 1,
      serviceClientKey: 'hotel-service',
      checkInDate: '2026-10-01',
      checkOutDate: '2026-10-03',
    },
    passengerAssignments: [
      { customerId: 'guest', serviceClientKeys: ['hotel-service'] },
    ],
  };
  const actor = {
    permissions: ['reservations.read'],
    branchIds: ['branch'],
  } as never;
  expect(await service.hotelGuestAges(snapshot as never, actor)).toEqual([35]);
  hotel.rooms[0]!.childAges = [8];
  expect(await service.hotelGuestAges(snapshot as never, actor)).toBeNull();
});
