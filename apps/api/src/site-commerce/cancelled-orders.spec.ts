import { afterEach, expect, it, vi } from 'vitest';
import { SiteCommerceService } from './site-commerce.service';
import { SalesService } from '../sales/sales.service';
import { SalesRepository } from '../sales/sales.repository';
import type { AuthenticatedActor } from '@nora/contracts';
const previous = process.env.SITE_COMMERCE_BINDINGS;
afterEach(() => {
  if (previous === undefined) delete process.env.SITE_COMMERCE_BINDINGS;
  else process.env.SITE_COMMERCE_BINDINGS = previous;
});
const actor: AuthenticatedActor = {
  userId: 'site',
  branchIds: ['hq', 'other'],
  sessionId: '',
  permissions: ['sales.contracts.create'],
};
function setup() {
  process.env.SITE_COMMERCE_BINDINGS = JSON.stringify({
    nss: { userId: 'site', branchId: 'hq' },
  });
  const findMany = vi.fn().mockResolvedValue([
    { externalId: 'order-a', contractId: 'a' },
    { externalId: 'order-b', contractId: 'b' },
  ]);
  const facts = vi.fn().mockResolvedValue([{ id: 'b' }]);
  const service = new SiteCommerceService(
    {
      client: {
        websiteOrder: { findMany },
        websitePublication: { findMany: vi.fn().mockResolvedValue([]) },
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    { cancelledWebsiteContracts: facts } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, findMany, facts };
}
it('projects only exact cancelled links with no private or financial fields', async () => {
  const x = setup();
  expect(await x.service.cancelledOrders('nss', actor)).toEqual([
    { externalId: 'order-b', contractId: 'b' },
  ]);
  expect(x.findMany).toHaveBeenCalledWith({
    where: { siteCode: 'nss', branchId: 'hq' },
    select: { externalId: true, contractId: true },
    orderBy: { id: 'asc' },
    take: 10001,
  });
  expect(x.facts).toHaveBeenCalledWith(['a', 'b'], {
    ...actor,
    branchIds: ['hq'],
  });
});
it('rejects another principal before reading linked orders and refuses truncation', async () => {
  const x = setup();
  await expect(
    x.service.cancelledOrders('nss', { ...actor, userId: 'other' }),
  ).rejects.toThrow();
  expect(x.findMany).not.toHaveBeenCalled();
  x.findMany.mockResolvedValue(
    Array.from({ length: 10001 }, () => ({
      externalId: 'order',
      contractId: 'c',
    })),
  );
  await expect(x.service.cancelledOrders('nss', actor)).rejects.toThrow();
  expect(x.facts).not.toHaveBeenCalled();
});
it('Sales public read is bounded and permission-scoped without mutations', async () => {
  const repository = {
    cancelledWebsiteContracts: vi.fn().mockResolvedValue([{ id: 'c' }]),
  };
  const service = Object.assign(Object.create(SalesService.prototype), {
    repository,
  });
  expect(await service.cancelledWebsiteContracts(['c', 'c'], actor)).toEqual([
    { id: 'c' },
  ]);
  expect(repository.cancelledWebsiteContracts).toHaveBeenCalledWith(
    ['c'],
    ['hq', 'other'],
  );
  await expect(
    service.cancelledWebsiteContracts(['c'], { ...actor, permissions: [] }),
  ).rejects.toThrow();
  expect(await service.cancelledWebsiteContracts([], actor)).toEqual([]);
});
it('repository returns only IDs for cancelled contracts in the supplied branch and link set', async () => {
  const findMany = vi.fn().mockResolvedValue([]);
  const repository = Object.assign(Object.create(SalesRepository.prototype), {
    database: { client: { salesContract: { findMany } } },
  });
  await repository.cancelledWebsiteContracts(['linked'], ['hq']);
  expect(findMany).toHaveBeenCalledWith({
    where: {
      id: { in: ['linked'] },
      branchId: { in: ['hq'] },
      status: 'CANCELLED',
    },
    select: { id: true },
  });
});

it('includes cancellation facts in the signed catalog projection even when no products or logo adapter exist', async () => {
  const x = setup();
  expect(await x.service.catalog('nss', actor)).toEqual({
    version: 1,
    data: [],
    cancelledOrders: [{ externalId: 'order-b', contractId: 'b' }],
  });
});
