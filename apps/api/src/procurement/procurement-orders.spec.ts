import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { ProcurementService } from './procurement.service';

const actor = {
  userId: 'actor',
  branchIds: ['branch-a'],
  permissions: ['procurement.read.all'],
} as unknown as AuthenticatedActor;
function fixture() {
  const orders = vi.fn().mockResolvedValue([
    {
      id: 'order-1',
      requestId: 'request-1',
      version: 2,
      procurementOrderRequestid: { title: 'درخواست کامل', number: 'PR-1' },
    },
  ]);
  const versions = vi.fn().mockResolvedValue([{ id: 'version-2' }]);
  const lines = vi
    .fn()
    .mockResolvedValue([{ orderId: 'order-1', quantity: '2' }]);
  const service = Object.assign(
    Object.create(ProcurementService.prototype) as ProcurementService,
    {
      database: {
        client: {
          procurementOrder: { findMany: orders },
          procurementOrderVersion: { findMany: versions },
          procurementOrderItem: { findMany: lines },
        },
      },
    },
  ) as unknown as ProcurementService;
  return { service, orders, lines };
}
describe('Scoped persisted order list', () => {
  it('applies actor branch scope and current version lines to actual orders', async () => {
    const { service, orders, lines } = fixture();
    const result = await service.orders(
      { createdFrom: '2026-10-01', createdTo: '2026-10-06', search: 'درخواست' },
      actor,
    );
    expect(orders.mock.calls[0]![0].where).toMatchObject({
      procurementOrderRequestid: { branchId: { in: ['branch-a'] } },
      status: { not: 'CANCELLED' },
    });
    expect(lines.mock.calls[0]![0].where.orderVersionId).toEqual({
      in: ['version-2'],
    });
    expect(result.items[0]).toMatchObject({
      requestTitle: 'درخواست کامل',
      lines: [{ quantity: '2' }],
    });
  });
  it('rejects actors without read permission before listing orders', async () => {
    const { service, orders } = fixture();
    await expect(
      service.orders({}, { ...actor, permissions: [] }),
    ).rejects.toThrow();
    expect(orders).not.toHaveBeenCalled();
  });
  it('rejects invalid ranges and unknown statuses before database access', async () => {
    const { service, orders } = fixture();
    await expect(
      service.orders(
        { createdFrom: '2026-10-08', createdTo: '2026-10-06' },
        actor,
      ),
    ).rejects.toThrow();
    await expect(
      service.orders({ status: 'INVALID' }, actor),
    ).rejects.toThrow();
    expect(orders).not.toHaveBeenCalled();
  });
});
