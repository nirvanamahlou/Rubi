import { ConflictException } from '@nestjs/common';
import { Prisma } from '@nora/database';
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

describe('TicketPublicService standalone fare revisions', () => {
  it('requires the current revision, retries the same command and rejects changed key reuse', async () => {
    const offerId = '10000000-0000-4000-8000-000000000010';
    const price = {
      expectedRevision: 0,
      amount: '2500000',
      currencyCode: 'IRR',
    };
    const persisted = {
      offerId,
      revision: 1,
      amount: new Prisma.Decimal('2500000'),
      currencyCode: 'IRR',
      fingerprint: '',
    };
    const commands = new Map<string, typeof persisted>();
    const create = vi.fn(
      ({ data }: { data: { commandKey: string; fingerprint: string } }) => {
        const row = { ...persisted, fingerprint: data.fingerprint };
        commands.set(data.commandKey, row);
        return Promise.resolve(row);
      },
    );
    const transaction = {
      ticketPublishedOffer: {
        findFirst: vi.fn().mockResolvedValue({ id: offerId }),
      },
      ticketOfferStandaloneSalePrice: {
        findUnique: vi.fn(
          ({
            where,
          }: {
            where: { offerId_commandKey: { commandKey: string } };
          }) =>
            Promise.resolve(
              commands.get(where.offerId_commandKey.commandKey) ?? null,
            ),
        ),
        findFirst: vi.fn().mockResolvedValue(null),
        create,
      },
    };
    const client = {
      $transaction: (call: (tx: typeof transaction) => Promise<unknown>) =>
        call(transaction),
    };
    const service = new TicketPublicService(
      { client } as unknown as DatabaseService,
      {} as ProcurementPublicService,
    );
    await expect(
      service.updateStandaloneSalePrice(offerId, price, actor, 'price-key'),
    ).resolves.toEqual({
      data: { revision: 1, amount: '2500000', currencyCode: 'IRR' },
    });
    await expect(
      service.updateStandaloneSalePrice(offerId, price, actor, 'price-key'),
    ).resolves.toEqual({
      data: { revision: 1, amount: '2500000', currencyCode: 'IRR' },
    });
    expect(create).toHaveBeenCalledTimes(1);
    await expect(
      service.updateStandaloneSalePrice(
        offerId,
        { ...price, amount: '2600000' },
        actor,
        'price-key',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('TicketPublicService offer retry', () => {
  it('accepts the same persisted offer despite a legacy order-dependent fingerprint', async () => {
    const upsert = vi.fn().mockResolvedValue(row);
    const ensureOfferPurchaseRequest = vi.fn();
    const service = new TicketPublicService(
      {
        client: {
          ticketPublishedOffer: { upsert },
          ticketOfferStandaloneSalePrice: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        },
      } as unknown as DatabaseService,
      { ensureOfferPurchaseRequest } as unknown as ProcurementPublicService,
    );
    await expect(
      service.publish(input, actor, 'branch-1', 'same-key'),
    ).resolves.toEqual({ data: { id: 'offer-1', version: 1 } });
    expect(ensureOfferPurchaseRequest).toHaveBeenCalledWith(row);
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
          ticketOfferStandaloneSalePrice: {
            findUnique: vi.fn().mockResolvedValue(null),
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
