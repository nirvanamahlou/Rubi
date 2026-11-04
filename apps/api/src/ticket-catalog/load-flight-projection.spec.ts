import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedActor,
  SalesTicketSelectionInput,
  SalesReservationRequestV1,
} from '@nora/contracts';
import { TicketPublicService } from './ticket-public.service';
import { SalesService } from '../sales/sales.service';
import { TravelWorkflowService } from '../reservations/travel-workflow.service';
import { ReservationsPublicService } from '../reservations/reservations-public.service';
const selection: SalesTicketSelectionInput = {
  serviceClientKey: 'out',
  direction: 'OUTBOUND',
  offerId: 'offer',
  originId: 'sales-origin',
  destinationId: 'sales-destination',
  departureAt: '2026-11-01T10:00:00.000Z',
  arrivalAt: '2026-11-01T12:00:00.000Z',
  carrierNameSnapshot: 'Air',
  serviceNumberSnapshot: '123',
  cabinClassCode: 'ECONOMY',
  quotedPrice: { amount: '100', currencyCode: 'USD' },
};
const actor = {
  userId: 'seller',
  branchIds: ['branch'],
  permissions: ['sales.contracts.read.own'],
} as AuthenticatedActor;
function fixture() {
  const offer = {
    id: 'offer',
    departureAt: new Date(selection.departureAt),
    arrivalAt: new Date(selection.arrivalAt),
    carrierName: 'Air',
    serviceNumber: '123',
    cabinClassCode: 'ECONOMY',
    status: 'STOPPED',
    totalCapacity: 0,
  };
  const findMany = vi.fn(async () => [offer]);
  const catalog = new TicketPublicService(
    { client: { ticketPublishedOffer: { findMany } } } as never,
    {} as never,
  );
  const saved = structuredClone(selection);
  const snapshot = {
    ticketSelections: [saved],
    passengerIds: ['person'],
    selectedTicketOfferIds: ['offer'],
    serviceSelections: [],
  } as unknown as SalesReservationRequestV1;
  const intake = {
    id: '10000000-0000-4000-8000-000000000001',
    requestId: 'request',
    contractId: 'contract',
    contractVersion: 1,
    branchId: 'branch',
    receivedAt: new Date(),
    snapshot,
    arrangements: [],
    workflowRevisions: [],
    servicePurchases: [],
    hotelPurchases: [],
    ticketDocuments: [
      {
        customerId: 'person',
        number: 'ISSUED-123',
        source: 'AUTO',
        issuedAt: new Date('2026-10-01'),
      },
    ],
  };
  const db = {
    client: {
      reservationIntake: {
        findFirst: vi.fn(async () => intake),
        findMany: vi.fn(async () => [intake]),
      },
    },
  };
  const workflow = new TravelWorkflowService(
    db as never,
    {} as never,
    {} as never,
    {} as never,
    { versionFor: vi.fn(async () => 1) } as never,
    catalog,
  );
  const reservations = new ReservationsPublicService(db as never, catalog);
  const contract = {
    id: 'contract',
    branchId: 'branch',
    ownerUserId: 'seller',
    status: 'SENT_TO_RESERVATIONS',
    version: 1,
    departureDate: new Date('2026-11-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
    services: [{ id: 'service', clientKey: 'out', kind: 'FLIGHT' }],
    passengers: [],
    payments: [],
    priceComponents: [
      { type: 'BASE', title: 'Sold', amount: '100', currencyCode: 'USD' },
    ],
    ticketSelections: [
      {
        ...saved,
        serviceId: 'service',
        departureAt: new Date(saved.departureAt),
        arrivalAt: new Date(saved.arrivalAt),
        quotedAmount: '100',
        quotedCurrencyCode: 'USD',
      },
    ],
  };
  const repository = { findById: vi.fn(async () => contract) };
  const customers = { resolveSnapshot: vi.fn(), assertPassengers: vi.fn() };
  const reserve = vi.fn(async () => {
    throw new Error('reserve boundary');
  });
  const sales = new SalesService(
    repository as never,
    customers as never,
    {
      reserve,
      currentSelections: catalog.currentSelections.bind(catalog),
    } as never,
  );
  return {
    offer,
    catalog,
    findMany,
    saved,
    snapshot,
    intake,
    workflow,
    reservations,
    sales,
    contract,
    db,
    reserve,
  };
}
describe('linked load current schedule across contract and issued ticket reads', () => {
  it('reflects a load revision in Sales and already-issued ticket downloads without rewriting snapshots, price or issuance', async () => {
    const f = fixture();
    expect(
      (await f.sales.detail('contract', actor)).data.ticketSelections[0]
        ?.departureAt,
    ).toBe(selection.departureAt);
    f.offer.departureAt = new Date('2026-11-01T23:30:00Z');
    f.offer.arrivalAt = new Date('2026-11-02T02:00:00Z');
    f.offer.carrierName = 'Updated Air';
    f.offer.serviceNumber = 'UPDATED-456';
    const detail = (await f.sales.detail('contract', actor)).data;
    const issued = await f.workflow.detail(f.intake.id, ['branch']);
    for (const flights of [
      detail.ticketSelections,
      issued.snapshot.ticketSelections,
    ]) {
      expect(flights?.[0]).toMatchObject({
        departureAt: f.offer.departureAt.toISOString(),
        arrivalAt: f.offer.arrivalAt.toISOString(),
        carrierNameSnapshot: 'Updated Air',
        serviceNumberSnapshot: 'UPDATED-456',
        quotedPrice: { amount: '100', currencyCode: 'USD' },
        originId: 'sales-origin',
        serviceClientKey: 'out',
      });
    }
    expect(issued.ticketDocuments[0]?.number).toBe('ISSUED-123');
    expect(detail.priceComponents[0]?.amount).toBe('100');
    expect(detail.version).toBe(1);
    expect(f.saved.departureAt).toBe(selection.departureAt);
    expect(f.saved.serviceNumberSnapshot).toBe(selection.serviceNumberSnapshot);
    expect(f.snapshot.ticketSelections?.[0]?.departureAt).toBe(
      selection.departureAt,
    );
    expect(f.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: { in: ['offer'] }, branchId: 'branch' },
      }),
    );
  });
  it('projects the reservation panel in a branch batch while preserving each contract quote', async () => {
    const f = fixture();
    f.offer.departureAt = new Date('2026-11-01T13:00:00Z');
    f.db.client.reservationIntake.findMany.mockResolvedValue([
      f.intake,
      {
        ...f.intake,
        id: 'second',
        contractId: 'second',
        snapshot: {
          ...f.snapshot,
          ticketSelections: [
            {
              ...selection,
              serviceClientKey: 'second-out',
              departureAt: '2026-11-01T15:00:00.000Z',
              quotedPrice: { amount: '999', currencyCode: 'EUR' },
            },
          ],
        },
      },
    ]);
    const list = await f.reservations.list(['branch']);
    expect(list[0]?.snapshot.ticketSelections?.[0]).toMatchObject({
      departureAt: f.offer.departureAt.toISOString(),
      quotedPrice: selection.quotedPrice,
    });
    expect(list[1]?.snapshot.ticketSelections?.[0]).toMatchObject({
      serviceClientKey: 'second-out',
      quotedPrice: { amount: '999', currencyCode: 'EUR' },
    });
    expect(f.findMany).toHaveBeenCalledOnce();
    f.findMany.mockResolvedValue([]);
    const historical = await f.reservations.list(['branch']);
    expect(historical[0]?.snapshot.ticketSelections?.[0]?.departureAt).toBe(
      selection.departureAt,
    );
    expect(historical[1]?.snapshot.ticketSelections?.[0]?.departureAt).toBe(
      '2026-11-01T15:00:00.000Z',
    );
  });
  it('keeps missing/foreign offer snapshots and never queries inventory for a floating-only contract', async () => {
    const f = fixture();
    f.findMany.mockResolvedValue([]);
    expect(
      await f.catalog.currentSelections([selection], 'other-branch'),
    ).toEqual([selection]);
    expect(await f.catalog.currentSelections([], 'branch')).toEqual([]);
    expect(f.findMany).toHaveBeenCalledOnce();
  });
  it('checks contract access before reading any current catalog data', async () => {
    const f = fixture();
    await expect(
      f.sales.detail('contract', { ...actor, userId: 'other' }),
    ).rejects.toThrow('دامنه');
    expect(f.findMany).not.toHaveBeenCalled();
  });
});

it('confirms an existing draft using the revised schedule while retaining its sale quote', async () => {
  const f = fixture();
  f.contract.status = 'DRAFT';
  f.offer.departureAt = new Date('2026-11-01T19:00:00Z');
  await expect(
    f.sales.confirm(
      'contract',
      1,
      null,
      {
        ...actor,
        permissions: [
          ...actor.permissions,
          'sales.contracts.confirm',
          'sales.reservation_request.create',
        ],
      },
      'retry',
    ),
  ).rejects.toThrow('reserve boundary');
  expect(f.reserve).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({
        departureAt: f.offer.departureAt.toISOString(),
        quotedPrice: selection.quotedPrice,
      }),
    ]),
    'branch',
    'contract',
    expect.any(Number),
    expect.anything(),
    expect.anything(),
  );
});
