import { it, expect, vi } from 'vitest';
import { Prisma } from '@nora/database';
import { TicketPublicService } from './ticket-public.service';
it('uses the latest historical direct-sale revision per scope within the authorized branch', async () => {
  const findMany = vi.fn().mockResolvedValue([
    {
      scopeKey: 'single',
      offerId: 'out',
      returnOfferId: null,
      percent: new Prisma.Decimal(7),
    },
    {
      scopeKey: 'pair',
      offerId: 'out',
      returnOfferId: 'back',
      percent: new Prisma.Decimal(9),
    },
    {
      scopeKey: 'single',
      offerId: 'out',
      returnOfferId: null,
      percent: new Prisma.Decimal(5),
    },
  ]);
  const service = new TicketPublicService(
    { client: { ticketSaleCommissionRevision: { findMany } } } as never,
    {} as never,
  );
  const at = new Date('2026-09-01T10:00:00Z');
  expect(
    await service.reservationCommissions(['out', 'back'], 'back', at, [
      'branch',
    ]),
  ).toEqual([
    { offerId: 'out', returnOfferId: null, percent: '7' },
    { offerId: 'out', returnOfferId: 'back', percent: '9' },
  ]);
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        occurredAt: { lte: at },
        salePriceTargetId: null,
        offer: { branchId: { in: ['branch'] } },
      }),
      orderBy: { occurredAt: 'desc' },
    }),
  );
  findMany.mockClear();
  expect(
    await service.reservationCommissions([], null, at, ['branch']),
  ).toEqual([]);
  expect(findMany).not.toHaveBeenCalled();
});
