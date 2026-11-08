import { beforeEach, expect, it, vi } from 'vitest';
import type { DashboardSourceQuery } from '../common/dashboard-source';
import { readCustomerBehaviorDashboard } from './customer-behavior-dashboard.public';

const ports = vi.hoisted(() => ({ sales: vi.fn(), leads: vi.fn() }));
vi.mock('../sales/sales-customer-behavior.public', () => ({
  readSalesCustomerBehavior: ports.sales,
}));
vi.mock('../customer-affairs/lead-interest-signals.public', () => ({
  readLeadInterestSignals: ports.leads,
}));
const at = new Date('2026-10-15');
const query: DashboardSourceQuery = {
  actor: {
    userId: 'actor',
    branchIds: ['branch'],
    permissions: ['customers.read'],
  },
  from: new Date('2026-10-01'),
  to: new Date('2026-11-01'),
  dateBasis: 'effective',
  filters: {},
};
beforeEach(() => vi.resetAllMocks());
it('deduplicates canonical customers across purchases and explicit requests, without leaking identity references', async () => {
  ports.sales.mockResolvedValue({
    state: 'ready',
    signals: [
      {
        customerId: 'PRIVATE_CUSTOMER',
        at,
        service: 'FLIGHT',
        destinationId: 'city',
      },
      {
        customerId: 'PRIVATE_CUSTOMER',
        at,
        service: 'HOTEL',
        destinationId: 'city',
      },
      {
        customerId: 'PRIVATE_CUSTOMER',
        at,
        service: 'FLIGHT',
        destinationId: 'city',
      },
      { customerId: 'MERGED_CUSTOMER', at, service: 'FLIGHT' },
    ],
  });
  ports.leads.mockResolvedValue({
    state: 'ready',
    signals: [
      {
        customerId: 'PRIVATE_CUSTOMER',
        at,
        service: 'HOTEL',
        destinationId: 'city',
      },
    ],
  });
  const findMany = vi.fn().mockResolvedValue([{ id: 'PRIVATE_CUSTOMER' }]);
  const result = await readCustomerBehaviorDashboard(
    {
      customer: { findMany },
      masterCity: {
        findMany: vi.fn().mockResolvedValue([{ id: 'city', name: 'City' }]),
      },
    } as never,
    query,
  );
  expect(
    result.metrics['customer-interest-coverage']?.observations,
  ).toHaveLength(1);
  expect(result.metrics['customer-service-usage']?.observations).toHaveLength(
    2,
  );
  expect(result.metrics['customer-interest-count']?.observations).toHaveLength(
    3,
  );
  expect(findMany.mock.calls[0]![0].where).toMatchObject({
    ownerBranchId: { in: ['branch'] },
    isCustomer: true,
    mergedIntoId: null,
  });
  expect(JSON.stringify(result)).not.toContain('PRIVATE_CUSTOMER');
  expect(JSON.stringify(result)).not.toContain('MERGED_CUSTOMER');
});
it('publishes authorized service usage but withholds incomplete interests when lead access is denied', async () => {
  ports.sales.mockResolvedValue({ state: 'ready', signals: [] });
  ports.leads.mockResolvedValue({ state: 'forbidden' });
  const result = await readCustomerBehaviorDashboard(
    { masterCity: { findMany: vi.fn().mockResolvedValue([]) } } as never,
    query,
  );
  expect(result.metrics['customer-service-usage']?.observations).toEqual([]);
  expect(result.metrics['customer-interest-coverage']).toBeUndefined();
  expect(result.unavailableMetrics?.['customer-interest-coverage']).toBe(
    'SOURCE_PERMISSION_REQUIRED',
  );
});
it('does not read either domain or canonical identities without customer permission', async () => {
  expect(
    await readCustomerBehaviorDashboard({} as never, {
      ...query,
      actor: { ...query.actor, permissions: [] },
    }),
  ).toMatchObject({ state: 'forbidden', metrics: {} });
  expect(ports.sales).not.toHaveBeenCalled();
  expect(ports.leads).not.toHaveBeenCalled();
});
