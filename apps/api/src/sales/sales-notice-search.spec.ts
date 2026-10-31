import { expect, it, vi } from 'vitest';
import { SalesRepository } from './sales.repository';
import type { DatabaseService } from '../database/database.service';

it.each([true, false])(
  'searches only the printed Notice as a substring and retains scope, filters and counts (payment read=%s)',
  async (allowed) => {
    const findMany = vi.fn().mockResolvedValue([]),
      count = vi.fn().mockResolvedValue(0);
    const repo = new SalesRepository({
      client: { salesContract: { findMany, count } },
    } as unknown as DatabaseService);
    const scope = { branchId: { in: ['own-branch'] }, ownerUserId: 'owner' };
    await repo.list(
      {
        search: '120123',
        page: 2,
        pageSize: 10,
        status: 'SENT_TO_RESERVATIONS',
        destinationId: 'destination',
      },
      scope,
      allowed,
    );
    const args = findMany.mock.calls[0]![0];
    expect(args.where.AND[0]).toEqual(scope);
    expect(args.where.AND).toContainEqual({ status: 'SENT_TO_RESERVATIONS' });
    expect(args.where.AND).toContainEqual({ destinationId: 'destination' });
    const choices = args.where.AND[1].OR;
    expect(choices).toContainEqual({
      services: {
        some: {
          metadata: {
            path: ['contractNotice'],
            string_contains: '120123',
            mode: 'insensitive',
          },
        },
      },
    });
    expect(choices).toContainEqual({
      contractNumber: { contains: '120123', mode: 'insensitive' },
    });
    expect(choices).toContainEqual({
      customerNameSnapshot: { contains: '120123', mode: 'insensitive' },
    });
    expect(JSON.stringify(choices).includes('paymentReference')).toBe(allowed);
    expect(JSON.stringify(choices)).not.toContain('pricingNotes');
    expect(JSON.stringify(choices)).not.toContain('reservationNote');
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(count).toHaveBeenCalledWith({ where: args.where });
  },
);
it('keeps an unfiltered list unchanged and uses the same Notice filter for bounded export', async () => {
  const findMany = vi.fn().mockResolvedValue([]),
    count = vi.fn().mockResolvedValue(0);
  const repo = new SalesRepository({
    client: { salesContract: { findMany, count } },
  } as unknown as DatabaseService);
  const scope = { branchId: { in: ['branch'] } };
  await repo.list({}, scope);
  expect(findMany.mock.calls[0]![0].where.AND[1]).toEqual({});
  await repo.list({ search: 'AbC-120123' }, scope, false, 100);
  const args = findMany.mock.calls[1]![0];
  expect(args.where.AND[0]).toEqual(scope);
  expect(args.where.AND[1].OR).toContainEqual({
    services: {
      some: {
        metadata: {
          path: ['contractNotice'],
          string_contains: 'AbC-120123',
          mode: 'insensitive',
        },
      },
    },
  });
  expect(args.take).toBe(101);
});
