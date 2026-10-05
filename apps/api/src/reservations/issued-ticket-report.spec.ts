import { describe, it, expect, vi } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import type {
  SalesReservationRequestV1,
  AuthenticatedActor,
} from '@nora/contracts';
import {
  issuedRows,
  filterIssuedRows,
  reportRange,
} from './issued-ticket-report';
import { buildIssuedTicketWorkbook } from './issued-ticket-workbook';
import { ReservationTicketDocumentsService } from './reservation-ticket-documents';
const snapshot = {
  contractNumber: 'SC-test',
  passengerIds: ['p'],
  passengerAssignments: [
    {
      customerId: 'p',
      displayNameSnapshot: 'Test Passenger',
      serviceClientKeys: ['f'],
    },
  ],
  serviceSelections: [],
  ticketSelections: [
    {
      serviceClientKey: 'f',
      offerId: 'offer',
      direction: 'OUTBOUND',
      originId: 'a',
      destinationId: 'b',
      departureAt: '2026-10-10T00:00:00Z',
      arrivalAt: '2026-10-10T02:00:00Z',
      carrierNameSnapshot: 'Test Airline',
      serviceNumberSnapshot: 'T-1',
      cabinClassCode: 'ECONOMY',
    },
  ],
} as unknown as SalesReservationRequestV1;
const doc = {
  id: 'd',
  customerId: 'p',
  number: '001234',
  source: 'AUTO',
  issuedAt: new Date('2026-10-01T21:00:00Z'),
};
const actor = {
  permissions: ['reservations.read'],
  branchIds: ['branch'],
} as unknown as AuthenticatedActor;
describe('actual issued ticket reporting', () => {
  it('requires valid dates including Tehran day boundaries', () => {
    for (const q of [
      {},
      { issuedFrom: '2026-02-30', issuedTo: '2026-03-01' },
      { issuedFrom: '2026-10-05', issuedTo: '2026-10-01' },
    ])
      expect(() => reportRange(q)).toThrow();
    const r = reportRange({ issuedFrom: '2026-10-02', issuedTo: '2026-10-02' });
    expect(r.gte.toISOString()).toBe('2026-10-01T20:30:00.000Z');
    expect(r.lt.toISOString()).toBe('2026-10-02T20:30:00.000Z');
  });
  it('projects actual number/date only assigned flights and deduplicates each segment', () => {
    const rows = issuedRows(
      doc,
      {
        ...snapshot,
        ticketSelections: [
          ...snapshot.ticketSelections!,
          ...snapshot.ticketSelections!,
        ],
      },
      false,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ticketNumber: '001234',
      issuedAt: doc.issuedAt.toISOString(),
      passengerDisplayName: 'Test Passenger',
      flightNumber: 'T-1',
    });
    expect(
      issuedRows({ ...doc, customerId: 'hotel-only' }, snapshot, false),
    ).toEqual([]);
    expect(issuedRows(doc, snapshot, true)[0]?.status).toBe('voided');
  });
  it('combines substring and exact filters without pagination', () => {
    const rows = issuedRows(doc, snapshot, false);
    expect(
      filterIssuedRows(rows, {
        passenger: 'pass',
        airlineId: 'Test Airline',
        originCityId: 'a',
        status: 'issued',
        page: '9',
      }),
    ).toHaveLength(1);
    expect(filterIssuedRows(rows, { destinationCityId: 'a' })).toEqual([]);
  });
  it('authorizes and applies branch/date before reading documents', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new ReservationTicketDocumentsService(
      { client: { reservationTicketDocument: { findMany } } } as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.report(
        { issuedFrom: '2026-10-01', issuedTo: '2026-10-05' },
        { ...actor, permissions: [] },
      ),
    ).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled();
    await expect(service.report({}, actor)).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled();
    expect(
      await service.report(
        { issuedFrom: '2026-10-01', issuedTo: '2026-10-05' },
        actor,
      ),
    ).toEqual({ data: [] });
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { intake: { branchId: { in: ['branch'] } } },
      take: 10001,
    });
  });
  it('writes a valid header-only workbook and preserves IDs/formula text safely', () => {
    const zip = unzipSync(
      buildIssuedTicketWorkbook(
        [['001234', '=HYPERLINK("bad")']],
        ['Number', 'Passenger'],
      ),
    );
    const sheet = strFromU8(zip['xl/worksheets/sheet1.xml']!);
    expect(sheet).toContain('001234');
    expect(sheet).toContain('t="inlineStr"');
    expect(sheet).not.toContain('<f>');
    expect(sheet).toContain('&quot;bad&quot;');
    expect(
      strFromU8(
        unzipSync(buildIssuedTicketWorkbook([], ['Number']))[
          'xl/worksheets/sheet1.xml'
        ]!,
      ),
    ).toContain('A1:A1');
  });
});
