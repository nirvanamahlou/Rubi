import { expect, it, vi } from 'vitest';
import type { DashboardSourceQuery } from '../common/dashboard-source';
import { readSalesCustomerBehavior } from './sales-customer-behavior.public';
const query: DashboardSourceQuery = {
  actor: {
    userId: 'owner',
    branchIds: ['branch'],
    permissions: [
      'customers.read',
      'sales.payments.read',
      'sales.contracts.read.own',
    ],
  },
  from: new Date('2026-10-01'),
  to: new Date('2026-11-01'),
  dateBasis: 'effective',
  filters: {},
};
it('requires both Sales and Finance permissions, applies own scope, and uses the first successful payment date', async () => {
  const findMany = vi.fn().mockResolvedValue([
    {
      customerId: 'buyer',
      destinationId: 'city',
      confirmedAt: new Date('2026-09-15'),
      services: [{ kind: 'FLIGHT' }, { kind: 'FLIGHT' }, { kind: 'HOTEL' }],
      payments: [{ financeConfirmedAt: new Date('2026-10-15'), refunds: [] }],
    },
  ]);
  const client = { salesContract: { findMany } } as never;
  expect(
    await readSalesCustomerBehavior(client, {
      ...query,
      actor: {
        ...query.actor,
        permissions: ['customers.read', 'sales.contracts.read.own'],
      },
    }),
  ).toMatchObject({ state: 'forbidden' });
  expect(findMany).not.toHaveBeenCalled();
  const result = await readSalesCustomerBehavior(client, query);
  expect(result.state).toBe('ready');
  if (result.state === 'ready') {
    expect(result.signals).toHaveLength(2);
    expect(result.signals[0]?.at).toEqual(new Date('2026-10-15'));
  }
  expect(findMany.mock.calls[0]![0].where.AND[0]).toMatchObject({
    branchId: { in: ['branch'] },
    ownerUserId: 'owner',
  });
  expect(findMany.mock.calls[0]![0].where.AND[1].status.in).not.toContain(
    'CANCELLED',
  );
});
it('withholds the measure when an executed refund cannot be allocated to a service', async () => {
  const findMany = vi.fn().mockResolvedValue([
    {
      customerId: 'buyer',
      destinationId: 'city',
      confirmedAt: new Date('2026-10-02'),
      services: [{ kind: 'FLIGHT' }],
      payments: [
        {
          financeConfirmedAt: new Date('2026-10-03'),
          refunds: [{ id: 'refund' }],
        },
      ],
    },
  ]);
  expect(
    await readSalesCustomerBehavior(
      { salesContract: { findMany } } as never,
      query,
    ),
  ).toEqual({
    state: 'unsupported',
    reason: 'REFUND_SERVICE_ALLOCATION_REQUIRED',
  });
});
