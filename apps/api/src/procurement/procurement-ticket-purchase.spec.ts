import { ConflictException } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { Prisma } from '@nora/database';
import { describe, expect, it, vi } from 'vitest';

import { ProcurementPublicService } from './procurement-public.service';

const actor = {
  userId: '00000000-0000-4000-8000-000000000001',
  branchIds: ['00000000-0000-4000-8000-000000000002'],
  permissions: ['ticket_catalog.manage'],
} as unknown as AuthenticatedActor;

const input = {
  version: 1 as const,
  catalogProductReference: 'ticket-local-1',
  title: 'پرواز تهران به آنتالیا',
  serviceDate: '2026-09-22',
  supplierDisplaySnapshot: 'ایران ایرتور',
  amount: '420000000',
  currencyCode: 'IRR',
};

function row(status = 'PENDING') {
  return {
    id: '00000000-0000-4000-8000-000000000003',
    version: 1,
    branchId: actor.branchIds[0]!,
    catalogProductReference: input.catalogProductReference,
    title: input.title,
    serviceDate: new Date('2026-09-22T00:00:00.000Z'),
    supplierDisplaySnapshot: input.supplierDisplaySnapshot,
    amount: new Prisma.Decimal(input.amount),
    currencyCode: input.currencyCode,
    status,
    createdByUserId: actor.userId,
    createKey: 'request-key',
    fingerprint: 'different',
    createdAt: new Date('2026-09-14T10:00:00.000Z'),
    updatedAt: new Date('2026-09-14T10:00:00.000Z'),
  };
}

describe('Procurement ticket purchase requests', () => {
  it('persists the ticket purchase amount for Finance', async () => {
    const created = row();
    const transaction = {
      procurementTicketPurchaseRequest: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
    };
    const service = new ProcurementPublicService({
      client: {
        $transaction: (work: (tx: typeof transaction) => unknown) =>
          work(transaction),
      },
    } as never);
    await expect(
      service.registerTicketPurchase(
        input,
        actor,
        actor.branchIds[0],
        'request-key',
      ),
    ).resolves.toMatchObject({
      amount: '420000000',
      currencyCode: 'IRR',
      serviceDate: '2026-09-22',
      status: 'PENDING',
    });
    expect(
      transaction.procurementTicketPurchaseRequest.create,
    ).toHaveBeenCalled();
  });

  it('keeps the purchase locked after Finance has handled it', async () => {
    const transaction = {
      procurementTicketPurchaseRequest: {
        findUnique: vi.fn().mockResolvedValue(row('PAID')),
      },
    };
    const service = new ProcurementPublicService({
      client: {
        $transaction: (work: (tx: typeof transaction) => unknown) =>
          work(transaction),
      },
    } as never);
    await expect(
      service.registerTicketPurchase(
        input,
        actor,
        actor.branchIds[0],
        'new-request-key',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
