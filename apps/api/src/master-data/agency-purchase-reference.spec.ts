import { expect, it, vi } from 'vitest';
import { MasterSalesDirectory } from './master-sales-directory';
it('filters purchase choices by AGENCY role before pagination and exposes only id/name', async () => {
  const master = {
    list: vi.fn().mockResolvedValue({
      data: [{ id: 'a', name: 'Agency', attributes: { phone: 'private' } }],
      meta: { total: 1 },
    }),
  };
  const service = new MasterSalesDirectory(master as never, {} as never);
  expect(await service.agencyPurchaseOptions('name', 2)).toEqual({
    data: [{ id: 'a', name: 'Agency' }],
    meta: { total: 1 },
  });
  expect(master.list).toHaveBeenCalledWith(
    'organizations',
    expect.objectContaining({
      organizationRole: 'AGENCY',
      status: 'active',
      page: 2,
    }),
  );
});
it('rejects inactive agencies and broker-only organizations before any purchase can use them', async () => {
  for (const data of [
    {
      id: 'a',
      name: 'Agency',
      status: 'inactive',
      attributes: { roleCodes: 'AGENCY' },
    },
    {
      id: 'b',
      name: 'Broker',
      status: 'active',
      attributes: { roleCodes: 'BROKER' },
    },
  ]) {
    const service = new MasterSalesDirectory(
      { detail: vi.fn().mockResolvedValue({ data }) } as never,
      {} as never,
    );
    await expect(service.agencyPurchaseReference(data.id)).rejects.toThrow();
  }
  const service = new MasterSalesDirectory(
    {
      detail: vi.fn().mockResolvedValue({
        data: {
          id: 'a',
          name: 'Agency',
          status: 'active',
          attributes: { roleCodes: 'AGENCY,CUSTOMER' },
        },
      }),
    } as never,
    {} as never,
  );
  expect(await service.agencyPurchaseReference('a')).toEqual({
    id: 'a',
    name: 'Agency',
    source: 'ORGANIZATION',
  });
});
