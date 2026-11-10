import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedActor,
  SalesReservationRequestV1,
} from '@nora/contracts';
import {
  allocatedServiceRows,
  filterServiceRows,
  reservationFlightRows,
} from './service-report';
import { ReservationTicketDocumentsService } from './reservation-ticket-documents';
const snapshot = {
  contractNumber: 'SC-1',
  createdAt: '2026-10-01T10:00:00Z',
  passengerIds: ['hotel-person', 'visa-person'],
  passengerAssignments: [
    {
      customerId: 'hotel-person',
      displayNameSnapshot: 'Hotel Only',
      serviceClientKeys: ['hotel'],
    },
    {
      customerId: 'visa-person',
      displayNameSnapshot: 'Visa Person',
      serviceClientKeys: ['visa', 'insurance'],
    },
  ],
  serviceSelections: [
    { clientKey: 'hotel', kind: 'HOTEL', titleSnapshot: 'Hotel' },
    { clientKey: 'visa', kind: 'VISA', titleSnapshot: 'Visa' },
    { clientKey: 'insurance', kind: 'INSURANCE', titleSnapshot: 'Insurance' },
  ],
  hotelSelection: {
    serviceClientKey: 'hotel',
    hotelId: 'hotel-id',
    hotelNameSnapshot: 'Hotel Example',
    cityId: 'city',
    checkInDate: '2026-11-02',
    checkOutDate: '2026-11-08',
  },
} as unknown as SalesReservationRequestV1;
describe('allocated services report', () => {
  it('includes only the flight passenger assigned hotel stay without adding services or changing flight dates', () => {
    const flight = {
      serviceClientKey: 'flight',
      direction: 'OUTBOUND',
      originId: 'a',
      destinationId: 'b',
      departureAt: '2026-11-01T21:00:00Z',
      arrivalAt: '2026-11-02T01:00:00Z',
      carrierNameSnapshot: 'Airline',
      serviceNumberSnapshot: 'T1',
      cabinClassCode: 'ECONOMY',
    };
    const assigned = {
      ...snapshot,
      passengerAssignments: snapshot.passengerAssignments!.map((p) => ({
        ...p,
        serviceClientKeys: [...p.serviceClientKeys, 'flight'],
      })),
      ticketSelections: [flight],
      serviceSelections: snapshot.serviceSelections.map((s) =>
        s.kind === 'HOTEL'
          ? {
              ...s,
              metadata: {
                passengerHotelStaysV1: JSON.stringify({
                  'hotel-person': {
                    different: true,
                    checkInDate: '2026-11-04',
                    checkOutDate: '2026-11-09',
                  },
                }),
              },
            }
          : s,
      ),
    } as unknown as SalesReservationRequestV1;
    const rows = reservationFlightRows('i', assigned, [], false);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      customerId: 'hotel-person',
      hotelId: 'hotel-id',
      checkInDate: '2026-11-04',
      checkOutDate: '2026-11-09',
      departureAt: flight.departureAt,
      serviceKind: 'FLIGHT',
      reportStatus: 'ALLOCATED',
    });
    expect(rows[1]).toMatchObject({
      customerId: 'visa-person',
      hotelId: '',
      checkInDate: '',
      checkOutDate: '',
    });
  });
  it('includes hotel-only guests and assigned visa/insurance without inventing issuance', () => {
    const rows = allocatedServiceRows('intake', snapshot, false);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      passengerDisplayName: 'Hotel Only',
      hotelId: 'hotel-id',
      hotelName: 'Hotel Example',
      checkInDate: '2026-11-02',
      ticketNumber: '',
      status: 'allocated',
      reportStatus: 'ALLOCATED',
    });
    expect(rows.map((r) => r.serviceKind)).toEqual([
      'HOTEL',
      'VISA',
      'INSURANCE',
    ]);
    expect(
      allocatedServiceRows('i', { ...snapshot, passengerIds: [] }, false),
    ).toEqual([]);
  });
  it('filters hotel and contract travel date while absent travel dates stay out', () => {
    const range = {
      gte: new Date('2026-11-01T20:30Z'),
      lt: new Date('2026-11-02T20:30Z'),
    };
    const rows = allocatedServiceRows('i', snapshot, false);
    expect(
      filterServiceRows(
        rows,
        { dateBasis: 'TRAVEL', hotelId: 'hotel-id' },
        range,
      ),
    ).toHaveLength(1);
    expect(
      filterServiceRows(
        rows,
        { dateBasis: 'TRAVEL', serviceKind: 'VISA' },
        range,
      ),
    ).toHaveLength(1);
    expect(
      filterServiceRows(rows, { dateBasis: 'TRAVEL', hotelId: 'other' }, range),
    ).toEqual([]);
  });
  it('uses the saved individual stay instead of the shared hotel date', () => {
    const changed = {
      ...snapshot,
      serviceSelections: snapshot.serviceSelections.map((s) =>
        s.kind === 'HOTEL'
          ? {
              ...s,
              metadata: {
                passengerHotelStaysV1: JSON.stringify({
                  'hotel-person': {
                    different: true,
                    checkInDate: '2026-11-04',
                    checkOutDate: '2026-11-09',
                  },
                }),
              },
            }
          : s,
      ),
    };
    expect(allocatedServiceRows('x', changed, false)[0]).toMatchObject({
      checkInDate: '2026-11-04',
      checkOutDate: '2026-11-09',
      departureAt: '2026-11-04T00:00:00+03:30',
    });
    const noTravel = allocatedServiceRows(
      'x',
      { ...snapshot, hotelSelection: null },
      false,
    );
    expect(
      filterServiceRows(
        noTravel,
        { dateBasis: 'TRAVEL' },
        { gte: new Date('2026-11-01'), lt: new Date('2026-11-10') },
      ),
    ).toEqual([]);
  });
  it('enforces permission and branch scope, reports latest nonflight allocation only', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'latest',
        contractId: 'c',
        snapshot,
        ticketDocuments: [],
        workflowRevisions: [],
      },
      {
        id: 'old',
        contractId: 'c',
        snapshot,
        ticketDocuments: [],
        workflowRevisions: [],
      },
    ]);
    const service = new ReservationTicketDocumentsService(
      { client: { reservationIntake: { findMany } } } as never,
      {} as never,
      {} as never,
      { cityReference: vi.fn().mockResolvedValue({ name: 'City' }) } as never,
    );
    const query = {
      issuedFrom: '2026-10-01',
      issuedTo: '2026-10-02',
      serviceKind: 'all',
    };
    const actor = {
      permissions: ['reservations.read'],
      branchIds: ['branch'],
    } as unknown as AuthenticatedActor;
    await expect(
      service.serviceReport(query, { ...actor, permissions: [] }),
    ).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled();
    await expect(
      service.serviceReport(query, {
        ...actor,
        permissions: [
          'ui.manual.v3',
          'reservations.read',
          'ui.screen.reservations.home',
        ],
      }),
    ).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled();
    const result = await service.serviceReport(query, actor);
    expect(result.data).toHaveLength(3);
    expect(result.options.hotels).toEqual([
      { id: 'hotel-id', name: 'Hotel Example' },
    ]);
    expect(result.options.origins).toEqual([]);
    expect(result.options.destinations).toEqual([]);
    expect(findMany.mock.calls[0]?.[0].where).toEqual({
      branchId: { in: ['branch'] },
    });
  });
});

describe('reservation flight report across contract revisions', () => {
  const flight = {
    serviceClientKey: 'flight',
    offerId: 'offer',
    direction: 'OUTBOUND',
    originId: 'origin',
    destinationId: 'destination',
    departureAt: '2026-11-03T08:00:00Z',
    arrivalAt: '2026-11-03T10:00:00Z',
    carrierNameSnapshot: 'Example Air',
    serviceNumberSnapshot: 'NEW-100',
    cabinClassCode: 'ECONOMY',
  };
  const current = {
    ...snapshot,
    passengerIds: ['issued', 'unnumbered', 'hotel-only'],
    passengerAssignments: [
      {
        customerId: 'issued',
        displayNameSnapshot: 'Updated Passenger',
        serviceClientKeys: ['flight'],
      },
      {
        customerId: 'unnumbered',
        displayNameSnapshot: 'New Passenger',
        serviceClientKeys: ['flight'],
      },
      {
        customerId: 'hotel-only',
        displayNameSnapshot: 'Hotel Passenger',
        serviceClientKeys: ['hotel'],
      },
    ],
    ticketSelections: [
      flight,
      {
        ...flight,
        direction: 'RETURN',
        originId: 'destination',
        destinationId: 'origin',
        departureAt: '2026-11-10T08:00:00Z',
      },
    ],
  } as unknown as SalesReservationRequestV1;
  const document = {
    id: 'document',
    customerId: 'issued',
    number: '123456',
    source: 'AUTO',
    issuedAt: new Date('2026-10-20T09:00:00Z'),
  };
  const actor = {
    permissions: ['reservations.read'],
    branchIds: ['branch'],
  } as unknown as AuthenticatedActor;
  function setup() {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'current',
        contractId: 'contract',
        snapshot: current,
        ticketDocuments: [],
        workflowRevisions: [],
      },
      {
        id: 'old',
        contractId: 'contract',
        snapshot: {
          ...current,
          ticketSelections: [{ ...flight, serviceNumberSnapshot: 'OLD' }],
        },
        ticketDocuments: [
          document,
          { ...document, id: 'removed-doc', customerId: 'removed' },
        ],
        workflowRevisions: [],
      },
    ]);
    const service = new ReservationTicketDocumentsService(
      { client: { reservationIntake: { findMany } } } as never,
      {} as never,
      {} as never,
      {
        cityReference: vi.fn().mockImplementation(async (id) => ({ name: id })),
      } as never,
    );
    return { service, findMany };
  }
  const query = {
    issuedFrom: '2026-10-01',
    issuedTo: '2026-11-30',
    serviceKind: 'FLIGHT',
  };
  it('includes unnumbered assigned legs and carries real documents forward without historic duplicates', async () => {
    const { service, findMany } = setup();
    const result = await service.serviceReport(query, actor);
    expect(result.data).toHaveLength(4);
    expect(result.data.filter((r) => r.status === 'issued')).toHaveLength(2);
    expect(result.data.filter((r) => r.status === 'allocated')).toHaveLength(2);
    expect(
      result.data
        .filter((r) => r.status === 'issued')
        .every(
          (r) =>
            r.ticketNumber === '123456' &&
            r.issuedAt === document.issuedAt.toISOString(),
        ),
    ).toBe(true);
    expect(
      result.data
        .filter((r) => r.status === 'allocated')
        .every((r) => r.ticketNumber === '' && r.reportStatus === 'ALLOCATED'),
    ).toBe(true);
    expect(result.data.every((r) => r.flightNumber === 'NEW-100')).toBe(true);
    expect(result.data.map((r) => r.passengerDisplayName)).toEqual([
      'Updated Passenger',
      'Updated Passenger',
      'New Passenger',
      'New Passenger',
    ]);
    expect(new Set(result.data.map((r) => r.id)).size).toBe(4);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { branchId: { in: ['branch'] } },
      orderBy: [{ contractId: 'asc' }, { contractVersion: 'desc' }],
    });
  });
  it('applies status, document, passenger and travel-day filters to the same full rows used for exports', async () => {
    const { service } = setup();
    expect(
      (await service.serviceReport({ ...query, status: 'issued' }, actor)).data,
    ).toHaveLength(2);
    expect(
      (
        await service.serviceReport(
          { ...query, documentNumber: '123456' },
          actor,
        )
      ).data,
    ).toHaveLength(2);
    const result = await service.serviceReport(
      {
        ...query,
        passenger: 'New',
        dateBasis: 'TRAVEL',
        issuedFrom: '2026-11-03',
        issuedTo: '2026-11-03',
      },
      actor,
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      direction: 'OUTBOUND',
      status: 'allocated',
    });
  });
  it('uses latest cancellation state and current issuance number', async () => {
    const { service, findMany } = setup();
    const rows = await findMany();
    rows[0].ticketDocuments.push({ ...document, number: '654321' });
    rows[0].workflowRevisions.push({ state: { supplierStatus: 'CANCELLED' } });
    const result = await service.serviceReport(query, actor);
    expect(result.data).toHaveLength(4);
    expect(
      result.data.every(
        (r) => r.status === 'voided' && r.reportStatus === 'CANCELLED',
      ),
    ).toBe(true);
    expect(
      result.data.filter((r) => r.ticketNumber).map((r) => r.ticketNumber),
    ).toEqual(['654321', '654321']);
  });
});
