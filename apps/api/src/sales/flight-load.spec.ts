import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type {
  AuthenticatedActor,
  SalesTicketSelectionInput,
} from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { TicketPublicService } from '../ticket-catalog/ticket-public.service';
import type { MasterDataService } from '../master-data/master-data.service';
import { FlightLoadService } from './flight-load.service';
const offerId = '11111111-1111-4111-8111-111111111111';
const actor = {
  userId: 'owner',
  branchIds: ['branch'],
  permissions: ['ticket_catalog.read', 'sales.contracts.read.own'],
} as AuthenticatedActor;
const selection = (
  offer = offerId,
  serviceId = 'out',
  direction: 'OUTBOUND' | 'RETURN' = 'OUTBOUND',
) => ({
  offerId: offer,
  serviceId,
  direction,
  departureAt: new Date('2099-01-02T23:30:00Z'),
  arrivalAt: new Date('2099-01-03T02:00:00Z'),
  originId: 'a',
  destinationId: 'b',
  carrierNameSnapshot: 'Synthetic Air',
  serviceNumberSnapshot: '0012',
  cabinClassCode: 'ECONOMY',
});
const person = (
  ageCategory = 'ADT',
  serviceId = 'out',
  childAgeBand: string | null = null,
  birthDate: Date | null = null,
) => ({ ageCategory, childAgeBand, birthDate, allocations: [{ serviceId }] });
const row = () => ({
  id: 'contract',
  contractNumber: '00120',
  customerNameSnapshot: 'Synthetic buyer',
  status: 'CONFIRMED',
  branchId: 'branch',
  ticketSelections: [selection(), selection('return', 'back', 'RETURN')],
  services: [
    { id: 'out', clientKey: 'out', kind: 'FLIGHT', metadata: null },
    { id: 'back', clientKey: 'back', kind: 'FLIGHT', metadata: null },
  ],
  passengers: [
    person(),
    person('CHD', 'out', 'AGE_2_6'),
    person('INF'),
    person('ADT', 'back'),
  ],
});
const findMany = vi.fn(),
  reservationIntakes = vi.fn(),
  documentDetails = vi.fn(),
  currentSelections = vi.fn();
const service = new FlightLoadService(
  {
    client: {
      salesContract: { findMany },
      reservationIntake: { findMany: reservationIntakes },
    },
  } as unknown as DatabaseService,
  { documentDetails, currentSelections } as unknown as TicketPublicService,
  {
    detail: async (_: string, id: string) => ({ data: { name: id + ' city' } }),
  } as unknown as MasterDataService,
);
beforeEach(() => {
  vi.resetAllMocks();
  findMany.mockResolvedValue([row()]);
  reservationIntakes.mockResolvedValue([]);
  documentDetails.mockResolvedValue({});
  currentSelections.mockImplementation(async (s: SalesTicketSelectionInput[]) =>
    s.map((f) => ({
      ...f,
      departureAt:
        f.offerId === offerId ? '2099-01-04T23:30:00Z' : '2099-01-10T10:00:00Z',
    })),
  );
});
describe('exact ticket flight-load contracts', () => {
  it('counts return-only members and shows both contractual journey dates for a return selection', async () => {
    const r = await service.contracts('return', actor);
    expect(r.data[0]).toMatchObject({
      direction: 'RETURN',
      adults: 1,
      infants: 0,
      seats: 1,
      passengers: 1,
      outboundAt: '2099-01-04T23:30:00Z',
      returnAt: '2099-01-10T10:00:00Z',
    });
  });
  it('counts only this leg allocations, includes infants without seats and retains current clocks', async () => {
    const r = await service.contracts(offerId, actor);
    expect(r.data[0]).toMatchObject({
      contractNumber: '00120',
      adults: 1,
      children2To6: 1,
      infants: 1,
      passengers: 3,
      seats: 2,
      departureAt: '2099-01-04T23:30:00Z',
      returnAt: '2099-01-10T10:00:00Z',
    });
    expect(r.totals).toMatchObject({ contracts: 1, passengers: 3, seats: 2 });
    expect(r.data[0]).not.toHaveProperty('birthDate');
    expect(JSON.stringify(findMany.mock.calls[0]![0])).toContain(
      JSON.stringify({ ticketSelections: { some: { offerId } } }).slice(1, -1),
    );
  });
  it('applies own and branch restrictions in the database, before totals', async () => {
    await service.contracts(offerId, actor);
    expect(findMany.mock.calls[0]![0].where.AND[0]).toEqual({
      branchId: { in: ['branch'] },
      ownerUserId: 'owner',
    });
    expect(findMany.mock.calls[0]![0].where.AND[1]).toMatchObject({
      branchId: { in: ['branch'] },
      status: {
        in: ['CONFIRMED', 'SENT_TO_RESERVATIONS', 'IN_PROGRESS', 'COMPLETED'],
      },
    });
  });
  it('branch readers do not acquire an owner constraint; all still follows visible offer branches', async () => {
    await service.contracts(offerId, {
      ...actor,
      permissions: ['ticket_catalog.read', 'sales.contracts.read.branch'],
    });
    expect(findMany.mock.calls[0]![0].where.AND[0]).toEqual({
      branchId: { in: ['branch'] },
    });
    await service.contracts(offerId, {
      ...actor,
      permissions: ['ticket_catalog.read', 'sales.contracts.read.all'],
    });
    expect(findMany.mock.calls[1]![0].where.AND[1].branchId).toEqual({
      in: ['branch'],
    });
  });
  it.each([['ticket_catalog.read'], ['sales.contracts.read.all'], []])(
    'rejects incomplete grants %j before querying',
    async (...permissions) => {
      await expect(
        service.contracts(offerId, {
          ...actor,
          permissions: permissions as AuthenticatedActor['permissions'],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(findMany).not.toHaveBeenCalled();
    },
  );
  it('rejects a foreign/invalid offer through its public owner before reading contracts', async () => {
    documentDetails.mockRejectedValue(new ForbiddenException());
    await expect(service.contracts(offerId, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(findMany).not.toHaveBeenCalled();
  });
  it('keeps cancelled rows separate and never includes drafts in sold totals', async () => {
    findMany.mockResolvedValue([{ ...row(), status: 'CANCELLED' }]);
    const result = await service.contracts(offerId, actor, true);
    expect(findMany.mock.calls[0]![0].where.AND[1].status.in).toContain(
      'CANCELLED',
    );
    expect(result.totals.contracts).toBe(1);
    expect(result.data[0]!.status).toBe('CANCELLED');
  });
  it('moves an operationally cancelled contract out of sold load and back after reopen', async () => {
    reservationIntakes.mockResolvedValue([
      {
        contractId: 'contract',
        workflowRevisions: [
          { state: { supplierStatus: 'CANCELLED' }, createdAt: new Date() },
        ],
      },
    ]);
    expect((await service.contracts(offerId, actor)).totals.seats).toBe(0);
    const cancelled = await service.contracts(offerId, actor, true);
    expect(cancelled.data[0]!.status).toBe('CANCELLED');
    expect(cancelled.totals.seats).toBe(2);
    expect(reservationIntakes.mock.calls[0]![0].where).toEqual({
      contractId: { in: ['contract'] },
    });
    reservationIntakes.mockResolvedValue([
      {
        contractId: 'contract',
        workflowRevisions: [
          { state: { supplierStatus: 'NEW' }, createdAt: new Date() },
        ],
      },
    ]);
    expect((await service.contracts(offerId, actor)).totals.seats).toBe(2);
    expect(
      (await service.contracts(offerId, actor, true)).totals.contracts,
    ).toBe(0);
  });
  it('uses service-specific legacy aggregate counts without summing the return party', async () => {
    const data = row();
    data.passengers = [];
    data.services[0]!.metadata = {
      legacyServicePartiesV2: JSON.stringify({
        out: { adults: 2, children: 1, infants: 1 },
        back: { adults: 1, children: 0, infants: 0 },
      }),
    } as never;
    findMany.mockResolvedValue([data]);
    expect((await service.contracts(offerId, actor)).data[0]).toMatchObject({
      adults: 2,
      childrenUnknownAge: 1,
      infants: 1,
      passengers: 4,
      seats: 3,
    });
  });
  it('keeps unknown child ages distinct and derives a known band at the selected flight date', async () => {
    const data = row();
    data.passengers = [
      person('CHD'),
      person('CHD', 'out', null, new Date('2094-01-05')),
      person('CHD', 'out', 'AGE_6_12'),
    ];
    findMany.mockResolvedValue([data]);
    expect((await service.contracts(offerId, actor)).data[0]).toMatchObject({
      childrenUnknownAge: 1,
      children2To6: 1,
      children6To12: 1,
      passengers: 3,
    });
  });
  it('returns an empty report and avoids current-flight work when no matching contracts exist', async () => {
    findMany.mockResolvedValue([]);
    expect((await service.contracts(offerId, actor)).totals).toMatchObject({
      contracts: 0,
      passengers: 0,
      seats: 0,
    });
    expect(currentSelections).not.toHaveBeenCalled();
  });
  it('excludes a selection that no longer has any passenger in that leg', async () => {
    const data = row();
    data.passengers = [person('ADT', 'back')];
    findMany.mockResolvedValue([data]);
    expect((await service.contracts(offerId, actor)).totals.contracts).toBe(0);
  });
  it('never silently truncates a large export', async () => {
    findMany.mockResolvedValue(Array.from({ length: 10001 }, row));
    await expect(service.contracts(offerId, actor)).rejects.toThrow();
  });
});
