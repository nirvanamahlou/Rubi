import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import type { ProcurementPublicService } from '../procurement/procurement-public.service';
import {
  TicketPublicService,
  ticketLoadGroupId,
} from './ticket-public.service';

const id = '10000000-0000-4000-8000-000000000001';
const offer = {
  originId: id,
  destinationId: '10000000-0000-4000-8000-000000000002',
  departureAt: '2026-09-22T04:00:00.000Z',
  arrivalAt: '2026-09-22T07:00:00.000Z',
  carrierName: 'Carrier',
  serviceNumber: 'B9-1',
  cabinClassCode: 'ECONOMY' as const,
  totalCapacity: 40,
};
const actor = {
  userId: 'user',
  branchIds: ['branch'],
  permissions: ['ticket_catalog.manage'],
} as never;
function setup(patch = {}) {
  const row = {
    id,
    version: 1,
    branchId: 'branch',
    originId: offer.originId,
    destinationId: offer.destinationId,
    carrierName: offer.carrierName,
    serviceNumber: offer.serviceNumber,
    cabinClassCode: offer.cabinClassCode,
    totalCapacity: offer.totalCapacity,
    capacityAllocations: [],
    capacityHolds: [],
    tourOutboundDepartures: [],
    tourReturnDepartures: [],
    ...patch,
  };
  const tx = {
    $queryRaw: vi.fn(),
    ticketPublishedOffer: {
      findFirst: vi.fn().mockResolvedValue(row),
      findMany: vi
        .fn()
        .mockImplementation(async (query) =>
          query?.where?.id?.in ? [row] : [],
        ),
      update: vi.fn().mockResolvedValue({ ...row, version: 2 }),
      updateMany: vi.fn().mockImplementation(async (query) => ({
        count: query?.where?.id?.in?.length ?? 1,
      })),
    },
    ticketOfferAudit: { create: vi.fn(), createMany: vi.fn() },
  };
  const service = new TicketPublicService(
    {
      client: {
        $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx),
      },
    } as unknown as DatabaseService,
    {} as ProcurementPublicService,
  );
  return { tx, service };
}
describe('published ticket revision', () => {
  it('projects only the explicit stable load key format as a group', () => {
    expect(
      ticketLoadGroupId(
        'ticket-catalog:ticket-load:10000000-0000-4000-8000-000000000007:12',
      ),
    ).toBe('10000000-0000-4000-8000-000000000007');
    expect(
      ticketLoadGroupId('ticket-catalog:legacy-random-id'),
    ).toBeUndefined();
    expect(
      ticketLoadGroupId(
        'ticket-catalog:legacy-random-id',
        'ticket.offer.load-group:10000000-0000-4000-8000-000000000007',
      ),
    ).toBe('10000000-0000-4000-8000-000000000007');
  });
  it('rejects moving a separate offer onto another existing flight identity', async () => {
    const { tx, service } = setup();
    tx.ticketPublishedOffer.findMany.mockResolvedValue([
      {
        carrierName: offer.carrierName,
        serviceNumber: offer.serviceNumber,
        supplyType: null,
      },
    ] as never);
    await expect(
      service.revise(id, { expectedVersion: 1, offer }, actor),
    ).rejects.toThrow('قبلاً ثبت');
    expect(tx.ticketPublishedOffer.update).not.toHaveBeenCalled();
  });
  it('keeps an existing contract allocation valid after only the offer time changes', async () => {
    const branchId = '10000000-0000-4000-8000-000000000003';
    const contractId = '10000000-0000-4000-8000-000000000004';
    const allocation = {
      offerId: id,
      contractId,
      direction: 'OUTBOUND',
      quantity: 1,
      status: 'ACTIVE',
    };
    const tx = {
      $queryRaw: vi.fn(),
      ticketPublishedOffer: {
        findMany: vi.fn().mockResolvedValue([
          {
            id,
            ...offer,
            departureAt: new Date('2099-09-22T05:00:00Z'),
            arrivalAt: new Date('2099-09-22T08:00:00Z'),
            capacityAllocations: [allocation],
            capacityHolds: [],
          },
        ]),
      },
      ticketOfferCapacityAllocation: {
        findMany: vi.fn().mockResolvedValue([allocation]),
        create: vi.fn(),
      },
    };
    const service = new TicketPublicService(
      {
        client: {
          $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx),
        },
      } as unknown as DatabaseService,
      {} as ProcurementPublicService,
    );
    await expect(
      service.reserve(
        [
          {
            serviceClientKey: 'flight',
            direction: 'OUTBOUND',
            offerId: id,
            originId: offer.originId,
            destinationId: offer.destinationId,
            departureAt: offer.departureAt,
            arrivalAt: offer.arrivalAt,
            carrierNameSnapshot: offer.carrierName,
            serviceNumberSnapshot: offer.serviceNumber,
            cabinClassCode: offer.cabinClassCode,
          },
        ],
        branchId,
        contractId,
        1,
      ),
    ).resolves.toEqual({
      available: true,
      unavailableOfferIds: [],
      createdAllocationIds: [],
    });
    expect(tx.ticketOfferCapacityAllocation.create).not.toHaveBeenCalled();
  });
  it('logically archives an unlinked load and records the versioned audit', async () => {
    const { tx, service } = setup({ status: 'ACTIVE' });
    await expect(service.archiveExpired(id, 1, actor)).resolves.toEqual({
      data: { id },
    });
    expect(tx.ticketPublishedOffer.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [id] } },
      data: { status: 'PAUSED', version: { increment: 1 } },
    });
    expect(tx.ticketOfferAudit.createMany).toHaveBeenCalledWith({
      data: [
        {
          offerId: id,
          actorUserId: 'user',
          action: 'ticket.offer.archived',
          version: 2,
        },
      ],
    });
  });
  it('archives every requested load row in one transaction', async () => {
    const secondId = '10000000-0000-4000-8000-000000000009';
    const { tx, service } = setup({ status: 'ACTIVE' });
    const first = await tx.ticketPublishedOffer.findFirst();
    tx.ticketPublishedOffer.findMany.mockResolvedValue([
      first,
      { ...first, id: secondId, version: 4 },
    ] as never);
    await expect(
      service.archiveBatch(
        {
          items: [
            { id, expectedVersion: 1 },
            { id: secondId, expectedVersion: 4 },
          ],
        },
        actor,
      ),
    ).resolves.toEqual({ data: { ids: [id, secondId] } });
    expect(tx.ticketPublishedOffer.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.ticketOfferAudit.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ offerId: id, version: 2 }),
        expect.objectContaining({ offerId: secondId, version: 5 }),
      ]),
    });
  });
  it('archives a large load with one offer write and one audit write', async () => {
    const { tx, service } = setup({ status: 'ACTIVE' });
    const first = await tx.ticketPublishedOffer.findFirst();
    const rows = Array.from({ length: 1_000 }, (_, index) => ({
      ...first,
      id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    }));
    tx.ticketPublishedOffer.findMany.mockResolvedValue(rows as never);
    await expect(
      service.archiveBatch(
        {
          items: rows.map((row) => ({
            id: row.id,
            expectedVersion: row.version,
          })),
        },
        actor,
      ),
    ).resolves.toEqual({ data: { ids: rows.map(({ id }) => id).sort() } });
    expect(tx.ticketPublishedOffer.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.ticketOfferAudit.createMany).toHaveBeenCalledTimes(1);
    expect(tx.ticketOfferAudit.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ offerId: rows[0]!.id, version: 2 }),
        expect.objectContaining({ offerId: rows.at(-1)!.id, version: 2 }),
      ]),
    });
  });
  it.each(['capacityHolds', 'tourOutboundDepartures', 'tourReturnDepartures'])(
    'rejects archiving a load with linked %s',
    async (key) => {
      const { tx, service } = setup({ [key]: [{ id: 'linked' }] });
      await expect(service.archiveExpired(id, 1, actor)).rejects.toThrow(
        'قابل حذف نیست',
      );
      expect(tx.ticketPublishedOffer.updateMany).not.toHaveBeenCalled();
    },
  );
  it('logically archives sold rows while retaining their allocation history', async () => {
    const { tx, service } = setup({
      status: 'ACTIVE',
      capacityAllocations: [{ id: 'linked-sale' }],
    });
    await expect(service.archiveExpired(id, 1, actor)).resolves.toEqual({
      data: { id },
    });
    expect(tx.ticketPublishedOffer.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [id] } },
      data: { status: 'PAUSED', version: { increment: 1 } },
    });
  });
  it('rejects stale or unauthorized archive requests', async () => {
    const { tx, service } = setup({ version: 2 });
    await expect(service.archiveExpired(id, 1, actor)).rejects.toThrow(
      'لود تغییر کرده است',
    );
    expect(tx.ticketPublishedOffer.updateMany).not.toHaveBeenCalled();
    await expect(
      service.archiveExpired(id, 2, {
        ...(actor as object),
        permissions: [],
      } as never),
    ).rejects.toThrow();
  });
  it('reactivates an automatically expired flight moved into the future', async () => {
    const { tx, service } = setup({
      status: 'PAUSED',
      audit: [{ action: 'ticket.offer.expired' }],
    });
    await service.revise(
      id,
      {
        expectedVersion: 1,
        offer: {
          ...offer,
          departureAt: '2099-09-22T04:00:00Z',
          arrivalAt: '2099-09-22T07:00:00Z',
        },
      },
      actor,
    );
    expect(tx.ticketPublishedOffer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });
  it('does not reactivate a manually paused flight', async () => {
    const { tx, service } = setup({
      status: 'PAUSED',
      audit: [{ action: 'ticket.offer.paused' }],
    });
    await service.revise(id, { expectedVersion: 1, offer }, actor);
    expect(
      tx.ticketPublishedOffer.update.mock.calls[0]![0].data,
    ).not.toHaveProperty('status');
  });
  it('moves the same offer to 31 Shahrivar and records its new version', async () => {
    const { tx, service } = setup();
    await expect(
      service.revise(id, { expectedVersion: 1, offer }, actor),
    ).resolves.toEqual({ data: { id, version: 2 } });
    expect(tx.ticketPublishedOffer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id },
        data: expect.objectContaining({
          departureAt: new Date('2026-09-22T04:00:00Z'),
        }),
      }),
    );
    expect(tx.ticketOfferAudit.create).toHaveBeenCalledOnce();
    expect(tx.ticketPublishedOffer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id,
          branchId: { in: ['branch'] },
          audit: { none: { action: 'ticket.offer.archived' } },
        },
      }),
    );
  });
  it('revises every row of one load inside the same transaction', async () => {
    const secondId = '10000000-0000-4000-8000-000000000009';
    const rows = [
      {
        id,
        version: 1,
        branchId: 'branch',
        ...offer,
        departureAt: new Date(offer.departureAt),
        arrivalAt: new Date(offer.arrivalAt),
      },
      {
        id: secondId,
        version: 3,
        branchId: 'branch',
        ...offer,
        departureAt: new Date('2026-09-29T04:00:00.000Z'),
        arrivalAt: new Date('2026-09-29T07:00:00.000Z'),
      },
    ].map((row) => ({
      ...row,
      status: 'ACTIVE',
      capacityAllocations: [],
      capacityHolds: [],
      tourOutboundDepartures: [],
      tourReturnDepartures: [],
      audit: [],
    }));
    const tx = {
      $queryRaw: vi.fn(),
      ticketPublishedOffer: {
        findFirst: vi.fn(async ({ where }) =>
          rows.find((row) => row.id === where.id),
        ),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(async ({ where }) => ({
          ...rows.find((row) => row.id === where.id)!,
          version: rows.find((row) => row.id === where.id)!.version + 1,
        })),
      },
      ticketOfferAudit: { create: vi.fn() },
    };
    const service = new TicketPublicService(
      {
        client: {
          $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx),
        },
      } as unknown as DatabaseService,
      {} as ProcurementPublicService,
    );
    await expect(
      service.reviseBatch(
        {
          items: [
            { id, expectedVersion: 1, offer },
            {
              id: secondId,
              expectedVersion: 3,
              offer: {
                ...offer,
                departureAt: '2026-09-29T04:00:00.000Z',
                arrivalAt: '2026-09-29T07:00:00.000Z',
              },
            },
          ],
        },
        actor,
      ),
    ).resolves.toEqual({
      data: {
        items: [
          { id, version: 2 },
          { id: secondId, version: 4 },
        ],
      },
    });
    expect(tx.ticketPublishedOffer.update).toHaveBeenCalledTimes(2);
    expect(tx.ticketOfferAudit.create).toHaveBeenCalledTimes(2);
  });
  it('atomically adds generated rows while retaining the same load group', async () => {
    const groupId = '10000000-0000-4000-8000-000000000007';
    const createdId = '10000000-0000-4000-8000-000000000008';
    const row = {
      id,
      version: 1,
      branchId: 'branch',
      ...offer,
      departureAt: new Date(offer.departureAt),
      arrivalAt: new Date(offer.arrivalAt),
      originAirportId: null,
      destinationAirportId: null,
      supplyType: null,
      economyBaggageKg: null,
      businessBaggageKg: null,
      returnMinDays: null,
      returnMaxDays: null,
      manifestTemplateId: null,
      status: 'ACTIVE',
      createKey: `ticket-catalog:ticket-load:${groupId}:0`,
      createdByUserId: 'user',
      capacityAllocations: [],
      capacityHolds: [],
      tourOutboundDepartures: [],
      tourReturnDepartures: [],
      audit: [],
    };
    const created = {
      ...row,
      id: createdId,
      createKey: `ticket-catalog:ticket-load:${groupId}:1`,
      departureAt: new Date('2026-09-29T04:00:00.000Z'),
      arrivalAt: new Date('2026-09-29T07:00:00.000Z'),
    };
    const tx = {
      $queryRaw: vi.fn(),
      ticketPublishedOffer: {
        findFirst: vi.fn().mockResolvedValue(row),
        findMany: vi.fn(async ({ where }) => {
          if (where?.createdByUserId) return [created];
          if (where?.id?.in) return [row];
          return [];
        }),
        update: vi.fn().mockResolvedValue({ ...row, version: 2 }),
        updateMany: vi.fn(),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      ticketOfferAudit: { create: vi.fn(), createMany: vi.fn() },
    };
    const ensureOfferPurchaseRequest = vi.fn();
    const service = new TicketPublicService(
      {
        client: {
          $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx),
        },
      } as unknown as DatabaseService,
      { ensureOfferPurchaseRequest } as unknown as ProcurementPublicService,
    );
    const second = {
      ...offer,
      departureAt: '2026-09-29T04:00:00.000Z',
      arrivalAt: '2026-09-29T07:00:00.000Z',
    };

    await expect(
      service.resizeBatch(
        {
          current: [{ id, expectedVersion: 1 }],
          offers: [offer, second],
        },
        actor,
      ),
    ).resolves.toEqual({
      data: {
        items: [
          { id, version: 2 },
          { id: createdId, version: 1 },
        ],
        createdIds: [createdId],
        archivedIds: [],
      },
    });
    expect(tx.ticketPublishedOffer.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ createKey: created.createKey })],
    });
    expect(ensureOfferPurchaseRequest).toHaveBeenCalledWith(created);
  });
  it('atomically archives generated rows removed from the edited load', async () => {
    const secondId = '10000000-0000-4000-8000-000000000009';
    const groupId = '10000000-0000-4000-8000-000000000007';
    const rows = [id, secondId].map((rowId, index) => ({
      id: rowId,
      version: index + 1,
      branchId: 'branch',
      ...offer,
      departureAt: new Date(`2026-09-${22 + index}T04:00:00.000Z`),
      arrivalAt: new Date(`2026-09-${22 + index}T07:00:00.000Z`),
      originAirportId: null,
      destinationAirportId: null,
      supplyType: null,
      economyBaggageKg: null,
      businessBaggageKg: null,
      returnMinDays: null,
      returnMaxDays: null,
      manifestTemplateId: null,
      status: 'ACTIVE',
      createKey: `ticket-catalog:ticket-load:${groupId}:${index}`,
      capacityAllocations: [],
      capacityHolds: [],
      tourOutboundDepartures: [],
      tourReturnDepartures: [],
      audit: [],
    }));
    const tx = {
      $queryRaw: vi.fn(),
      ticketPublishedOffer: {
        findFirst: vi.fn(async ({ where }) =>
          rows.find((row) => row.id === where.id),
        ),
        findMany: vi.fn(async ({ where }) => (where?.id?.in ? rows : [])),
        update: vi.fn().mockResolvedValue({ ...rows[0]!, version: 2 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        createMany: vi.fn(),
      },
      ticketOfferAudit: { create: vi.fn(), createMany: vi.fn() },
    };
    const service = new TicketPublicService(
      {
        client: {
          $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx),
        },
      } as unknown as DatabaseService,
      {} as ProcurementPublicService,
    );

    await expect(
      service.resizeBatch(
        {
          current: [
            { id, expectedVersion: 1 },
            { id: secondId, expectedVersion: 2 },
          ],
          offers: [offer],
        },
        actor,
      ),
    ).resolves.toEqual({
      data: {
        items: [{ id, version: 2 }],
        createdIds: [],
        archivedIds: [secondId],
      },
    });
    expect(tx.ticketPublishedOffer.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [secondId] } },
      data: { status: 'PAUSED', version: { increment: 1 } },
    });
  });
  it('rejects stale edits before changing data', async () => {
    const { tx, service } = setup({ version: 2 });
    await expect(
      service.revise(id, { expectedVersion: 1, offer }, actor),
    ).rejects.toThrow('بلیط تغییر کرده');
    expect(tx.ticketPublishedOffer.update).not.toHaveBeenCalled();
  });
  it('allows a schedule-only revision after a contract reserved seats', async () => {
    const { tx, service } = setup({ capacityAllocations: [{ id: 'linked' }] });
    await expect(
      service.revise(
        id,
        {
          expectedVersion: 1,
          offer: {
            ...offer,
            departureAt: '2099-09-22T04:00:00Z',
            arrivalAt: '2099-09-22T07:00:00Z',
          },
        },
        actor,
      ),
    ).resolves.toEqual({ data: { id, version: 2 } });
    expect(tx.ticketPublishedOffer.update).toHaveBeenCalledOnce();
  });
  it('still rejects changing the route or capacity of a sold offer', async () => {
    const { tx, service } = setup({ capacityAllocations: [{ id: 'linked' }] });
    await expect(
      service.revise(
        id,
        { expectedVersion: 1, offer: { ...offer, totalCapacity: 41 } },
        actor,
      ),
    ).rejects.toThrow('فقط ساعت حرکت و رسیدن');
    expect(tx.ticketPublishedOffer.update).not.toHaveBeenCalled();
  });
  it.each(['capacityHolds', 'tourOutboundDepartures', 'tourReturnDepartures'])(
    'protects existing %s',
    async (key) => {
      const { tx, service } = setup({ [key]: [{ id: 'linked' }] });
      await expect(
        service.revise(id, { expectedVersion: 1, offer }, actor),
      ).rejects.toThrow('تعیین تکلیف');
      expect(tx.ticketPublishedOffer.update).not.toHaveBeenCalled();
    },
  );
});
