import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import type { ProcurementPublicService } from '../procurement/procurement-public.service';
import { TicketPublicService } from './ticket-public.service';

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
      update: vi.fn().mockResolvedValue({ ...row, version: 2 }),
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
  return { tx, service };
}
describe('published ticket revision', () => {
  it('archives an expired offer without deleting its contract or finance records', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn();
    const tx = {
      ticketPublishedOffer: { updateMany },
      ticketOfferAudit: { create },
    };
    const service = new TicketPublicService(
      {
        client: {
          $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx),
        },
      } as unknown as DatabaseService,
      {} as ProcurementPublicService,
    );
    await service.archiveExpired(id, 1, actor);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id,
        branchId: { in: ['branch'] },
        version: 1,
        audit: { none: { action: 'ticket.offer.archived' } },
        departureAt: { lte: expect.any(Date) },
      },
      data: { status: 'PAUSED', version: { increment: 1 } },
    });
    expect(create).toHaveBeenCalledOnce();
    updateMany.mockResolvedValue({ count: 0 });
    await expect(service.archiveExpired(id, 1, actor)).rejects.toThrow(
      'فقط بلیط تاریخ‌گذشته',
    );
    expect(create).toHaveBeenCalledTimes(1);
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
      expect.objectContaining({ where: { id, branchId: { in: ['branch'] } } }),
    );
  });
  it('rejects stale edits before changing data', async () => {
    const { tx, service } = setup({ version: 2 });
    await expect(
      service.revise(id, { expectedVersion: 1, offer }, actor),
    ).rejects.toThrow('بلیط تغییر کرده');
    expect(tx.ticketPublishedOffer.update).not.toHaveBeenCalled();
  });
  it.each([
    'capacityAllocations',
    'capacityHolds',
    'tourOutboundDepartures',
    'tourReturnDepartures',
  ])('protects existing %s', async (key) => {
    const { tx, service } = setup({ [key]: [{ id: 'linked' }] });
    await expect(
      service.revise(id, { expectedVersion: 1, offer }, actor),
    ).rejects.toThrow('متصل است');
    expect(tx.ticketPublishedOffer.update).not.toHaveBeenCalled();
  });
});
