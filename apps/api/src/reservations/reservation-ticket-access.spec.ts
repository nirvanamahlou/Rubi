import type { TravelWorkflowService } from './travel-workflow.service';
import type { FinanceDeliveryService } from '../finance/document-delivery/finance-delivery.module';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { ReservationsPublicService } from './reservations-public.service';
import { ReservationRequestsController } from './reservations-runtime.module';
import type { ReservationHotelPurchaseService } from './reservation-hotel-purchase.service';

function setup() {
  const findMany = vi.fn().mockResolvedValue([]);
  const service = new ReservationsPublicService({
    client: { reservationIntake: { findMany } },
  } as unknown as DatabaseService);
  return { findMany, service };
}
describe('reservation saved ticket access scope and history', () => {
  it('paginates beyond the newest hundred while retaining branch restrictions', async () => {
    const { service, findMany } = setup();
    await service.list(['branch-a'], {
      page: '3',
      contractNumber: ' SC-2026 ',
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId: { in: ['branch-a'] },
          snapshot: { path: ['contractNumber'], string_contains: 'SC-2026' },
        },
        take: 100,
        skip: 200,
        orderBy: [{ receivedAt: 'desc' }, { id: 'asc' }],
      }),
    );
  });
  it('an empty branch scope never becomes unrestricted', async () => {
    const { service, findMany } = setup();
    await service.list([]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { branchId: { in: [] } }, skip: 0 }),
    );
  });
  it.each(['0', '-1', '2.5', 'abc', '1000001'])(
    'rejects invalid page %s before querying',
    async (page) => {
      const { service, findMany } = setup();
      await expect(service.list(['a'], { page })).rejects.toThrow();
      expect(findMany).not.toHaveBeenCalled();
    },
  );
  it('rejects oversized contract searches', async () => {
    await expect(
      setup().service.list(['a'], { contractNumber: 'x'.repeat(101) }),
    ).rejects.toThrow();
  });
  it('rejects repeated/non-text search query parameters', async () => {
    await expect(
      setup().service.list(['a'], {
        contractNumber: ['SC', 'X'] as unknown as string,
      }),
    ).rejects.toThrow();
  });
  it('requires reservation read permission and takes scope exclusively from the actor', async () => {
    const { service, findMany } = setup();
    const controller = new ReservationRequestsController(
      service,
      {} as ReservationHotelPurchaseService,
      {} as TravelWorkflowService,
      {} as FinanceDeliveryService,
      {} as CustomerService,
      {} as IamService,
    );
    await expect(
      controller.list(
        {
          actor: { permissions: [], branchIds: ['a'] },
        } as unknown as AuthenticatedRequest,
        '1',
        'SC',
      ),
    ).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled();
    await controller.list(
      {
        actor: {
          permissions: ['reservations.read'],
          branchIds: ['authorized'],
        },
      } as unknown as AuthenticatedRequest,
      '2',
      'SC',
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId: { in: ['authorized'] },
          snapshot: { path: ['contractNumber'], string_contains: 'SC' },
        },
        skip: 100,
      }),
    );
  });
});
import type { CustomerService } from '../customers/customer.service';
import type { IamService } from '../iam/iam.service';
