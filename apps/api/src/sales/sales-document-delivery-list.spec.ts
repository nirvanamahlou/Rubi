import { expect, it, vi } from 'vitest';
import { SalesController } from './sales.controller';
import { FinanceDeliveryService } from '../finance/document-delivery/finance-delivery.module';

it('projects only delivery approval for Sales-scoped contracts without finance permissions', async () => {
  const actor = {
    userId: 'seller',
    branchIds: ['branch'],
    permissions: ['sales.contracts.read.own'],
  };
  const list = vi.fn().mockResolvedValue({
    data: [
      { id: 'approved', status: 'CONFIRMED' },
      { id: 'revoked', status: 'CONFIRMED' },
      { id: 'cancelled', status: 'CANCELLED' },
    ],
    meta: { total: 3 },
  });
  const approvedCustomerContractIds = vi
    .fn()
    .mockResolvedValue(['approved', 'cancelled']);
  const controller = new SalesController(
    {} as never,
    {} as never,
    { list } as never,
    {} as never,
    {} as never,
    { approvedCustomerContractIds } as never,
  );
  const result = await controller.list({}, { actor } as never);
  expect(list).toHaveBeenCalledWith({}, actor);
  expect(approvedCustomerContractIds).toHaveBeenCalledWith([
    'approved',
    'revoked',
    'cancelled',
  ]);
  expect(
    result.data.map((row) => row.customerDocumentDeliveryApproved),
  ).toEqual([true, false, false]);
  expect(result.meta).toEqual({ total: 3 });
});

it('does not request financial delivery state before Sales scope authorization', async () => {
  const approvedCustomerContractIds = vi.fn();
  const controller = new SalesController(
    {} as never,
    {} as never,
    { list: vi.fn().mockRejectedValue(new Error('denied')) } as never,
    {} as never,
    {} as never,
    { approvedCustomerContractIds } as never,
  );
  await expect(controller.list({}, { actor: {} } as never)).rejects.toThrow(
    'denied',
  );
  expect(approvedCustomerContractIds).not.toHaveBeenCalled();
});

it('reads latest delivery revisions in one bounded projection and excludes revocations', async () => {
  const findMany = vi.fn().mockResolvedValue([
    { contractId: 'approved', approved: true },
    { contractId: 'revoked', approved: false },
  ]);
  const service = new FinanceDeliveryService(
    {
      client: { financeCustomerDocumentDeliveryRevision: { findMany } },
    } as never,
    {} as never,
  );
  expect(await service.approvedCustomerContractIds([])).toEqual([]);
  expect(findMany).not.toHaveBeenCalled();
  expect(
    await service.approvedCustomerContractIds([
      'approved',
      'revoked',
      'approved',
    ]),
  ).toEqual(['approved']);
  expect(findMany).toHaveBeenCalledWith({
    where: { contractId: { in: ['approved', 'revoked'] } },
    orderBy: { version: 'desc' },
    distinct: ['contractId'],
    select: { contractId: true, approved: true },
  });
});
