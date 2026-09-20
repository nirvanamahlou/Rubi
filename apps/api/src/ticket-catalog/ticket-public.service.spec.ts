import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import type { ProcurementPublicService } from '../procurement/procurement-public.service';
import { TicketPublicService } from './ticket-public.service';

const input = {
  originId: '10000000-0000-4000-8000-000000000001',
  destinationId: '10000000-0000-4000-8000-000000000002',
  departureAt: '2026-11-01T04:30:00.000Z',
  arrivalAt: '2026-11-01T07:30:00.000Z',
  carrierName: 'Synthetic carrier',
  serviceNumber: 'TEST-100',
  cabinClassCode: 'ECONOMY' as const,
  totalCapacity: 2,
};
const actor = {
  userId: 'user-1',
  branchIds: ['branch-1'],
  permissions: ['ticket_catalog.manage'],
} as never;
const row = {
  id: 'offer-1',
  version: 1,
  branchId: 'branch-1',
  ...input,
  departureAt: new Date(input.departureAt),
  arrivalAt: new Date(input.arrivalAt),
  fingerprint: 'legacy-json-order-hash',
};

function expiryTransaction(
  expired: readonly { id: string; version: number }[] = [],
) {
  const findMany = vi.fn().mockResolvedValue(expired);
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const create = vi.fn().mockResolvedValue(undefined);
  const transaction = vi.fn(async (operation) =>
    operation({
      ticketPublishedOffer: { findMany, updateMany },
      ticketOfferAudit: { create },
    }),
  );
  return { transaction, findMany, updateMany, create };
}

describe('TicketPublicService offer retry', () => {
  it('accepts the same persisted offer despite a legacy order-dependent fingerprint', async () => {
    const upsert = vi.fn().mockResolvedValue(row);
    const ensureOfferPurchaseRequest = vi.fn();
    const service = new TicketPublicService(
      {
        client: { ticketPublishedOffer: { upsert } },
      } as unknown as DatabaseService,
      { ensureOfferPurchaseRequest } as unknown as ProcurementPublicService,
    );
    await expect(
      service.publish(input, actor, 'branch-1', 'same-key'),
    ).resolves.toEqual({ data: { id: 'offer-1', version: 1 } });
    expect(ensureOfferPurchaseRequest).toHaveBeenCalledWith(row);
  });

  it('lists the same active offer rows used by Sales for ticket management', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        ...row,
        status: 'ACTIVE',
        capacityAllocations: [{ quantity: 1 }],
        capacityHolds: [{ quantity: 1 }],
      },
    ]);
    const expiry = expiryTransaction();
    const service = new TicketPublicService(
      {
        client: {
          $transaction: expiry.transaction,
          ticketPublishedOffer: { findMany },
        },
      } as unknown as DatabaseService,
      {} as ProcurementPublicService,
    );
    await expect(service.managed(actor)).resolves.toEqual({
      version: 1,
      data: [
        expect.objectContaining({
          id: row.id,
          remainingCapacity: 0,
          totalCapacity: 2,
        }),
      ],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: { in: ['branch-1'] }, status: { not: 'ARCHIVED' } },
      }),
    );
  });

  it('automatically pauses departed offers with a versioned audit', async () => {
    const expiry = expiryTransaction([{ id: 'expired-offer', version: 4 }]);
    const list = vi.fn().mockResolvedValue([]);
    const service = new TicketPublicService(
      {
        client: {
          $transaction: expiry.transaction,
          ticketPublishedOffer: { findMany: list },
        },
      } as unknown as DatabaseService,
      {} as ProcurementPublicService,
    );

    await service.managed(actor);

    expect(expiry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: { in: ['branch-1'] },
          status: 'ACTIVE',
          departureAt: { lte: expect.any(Date) },
        }),
      }),
    );
    expect(expiry.updateMany).toHaveBeenCalledWith({
      where: { id: 'expired-offer', status: 'ACTIVE', version: 4 },
      data: { status: 'PAUSED', version: { increment: 1 } },
    });
    expect(expiry.create).toHaveBeenCalledWith({
      data: {
        offerId: 'expired-offer',
        actorUserId: 'user-1',
        action: 'ticket.offer.expired',
        version: 5,
      },
    });
  });

  it('still rejects a changed offer under the same key', async () => {
    const ensureOfferPurchaseRequest = vi.fn();
    const service = new TicketPublicService(
      {
        client: {
          ticketPublishedOffer: {
            upsert: vi
              .fn()
              .mockResolvedValue({ ...row, carrierName: 'Other carrier' }),
          },
        },
      } as unknown as DatabaseService,
      { ensureOfferPurchaseRequest } as unknown as ProcurementPublicService,
    );
    await expect(
      service.publish(input, actor, 'branch-1', 'same-key'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ensureOfferPurchaseRequest).not.toHaveBeenCalled();
  });
});
