import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import { SalesRepository } from './sales.repository';
import { validateSalesPayment } from './sales.domain';
import { SalesService } from './sales.service';
import type {
  SalesCustomersPublicAdapter,
  SalesTicketAvailabilityPort,
} from './sales.adapters';
import type { AuthenticatedActor } from '@rubi/contracts';

describe('Sales payment tracking references', () => {
  it.each([true, false])(
    'enables tracking search only from actor payment-read permissions (%s)',
    async (allowed) => {
      const list = vi
        .fn()
        .mockResolvedValue({ data: [], page: 1, pageSize: 20, total: 0 });
      const service = new SalesService(
        { list } as unknown as SalesRepository,
        {} as SalesCustomersPublicAdapter,
        {} as SalesTicketAvailabilityPort,
      );
      const actor = {
        userId: 'actor',
        branchIds: ['branch'],
        permissions: [
          'sales.contracts.read.own',
          ...(allowed ? ['sales.payments.read'] : []),
        ],
      } as unknown as AuthenticatedActor;
      await service.list({ search: 'TRACK-001' }, actor);
      expect(list).toHaveBeenCalledWith(
        { search: 'TRACK-001' },
        {
          branchId: { in: ['branch'] },
          OR: [{ ownerUserId: 'actor' }, { assignedUserId: 'actor' }],
        },
        allowed,
      );
      await expect(
        service.list(
          { search: 'TRACK-001' },
          { ...actor, permissions: ['sales.payments.read'] },
        ),
      ).rejects.toThrow('مجوز');
      expect(list).toHaveBeenCalledTimes(1);
    },
  );
  it.each([true, false])(
    'searches stored payment references only with permission=%s and retains scope',
    async (allowed) => {
      const findMany = vi.fn().mockResolvedValue([]),
        count = vi.fn().mockResolvedValue(0);
      const repository = new SalesRepository({
        client: { salesContract: { findMany, count } },
      } as unknown as DatabaseService);
      const scope = { branchId: { in: ['branch'] }, ownerUserId: 'actor' };
      await repository.list({ search: 'TRACK-001' }, scope, allowed);
      const where = findMany.mock.calls[0]![0].where;
      expect(where.AND[0]).toEqual(scope);
      expect(JSON.stringify(where).includes('paymentReference')).toBe(allowed);
      expect(count).toHaveBeenCalledWith({ where });
    },
  );
  it('accepts a reference but rejects malformed or oversized values before persistence', () => {
    const payment = {
      amount: '100',
      currencyCode: 'IRR',
      method: 'CASH' as const,
      dueAt: '2026-09-07T00:00:00Z',
    };
    expect(() =>
      validateSalesPayment({ ...payment, paymentReference: 'TRACK-001' }),
    ).not.toThrow();
    expect(() =>
      validateSalesPayment({ ...payment, paymentReference: 'x'.repeat(161) }),
    ).toThrow('شماره پیگیری');
    expect(() =>
      validateSalesPayment({ ...payment, paymentReference: 'x\n' }),
    ).toThrow('شماره پیگیری');
  });
});
