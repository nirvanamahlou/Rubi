import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedActor,
  SalesReservationRequestV1,
} from '@nora/contracts';
import { allocatedServiceRows, filterServiceRows } from './service-report';
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
