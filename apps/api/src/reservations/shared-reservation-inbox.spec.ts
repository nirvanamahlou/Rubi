import { expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import type { ContractCompanyScope } from '../sales/contract-company-scope.public';
import { ReservationsPublicService } from './reservations-public.service';

it('filters the shared queue by authorized branches and visible contracts before paging', async () => {
  const findMany = vi.fn().mockResolvedValue([]);
  const reservationInboxIds = vi.fn().mockResolvedValue(['a', 'b']);
  const service = new ReservationsPublicService(
    {
      client: { reservationIntake: { findMany } },
    } as unknown as DatabaseService,
    undefined,
    undefined,
    { reservationInboxIds } as unknown as ContractCompanyScope,
  );
  await service.list(['branch'], { page: '2', contractNumber: '42' });
  expect(reservationInboxIds).toHaveBeenCalledWith(['branch']);
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        branchId: { in: ['branch'] },
        contractId: { in: ['a', 'b'] },
        snapshot: { path: ['contractNumber'], string_contains: '42' },
      },
      distinct: ['contractId'],
      take: 100,
      skip: 100,
    }),
  );
  reservationInboxIds.mockResolvedValue([]);
  await service.list([]);
  expect(findMany).toHaveBeenLastCalledWith(
    expect.objectContaining({
      where: { branchId: { in: [] }, contractId: { in: [] } },
    }),
  );
});
