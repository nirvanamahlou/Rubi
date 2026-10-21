import { ForbiddenException } from '@nestjs/common';
import {
  MANUAL_ACCESS_VERSION,
  type AuthenticatedActor,
} from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import { TicketPublicService } from './ticket-public.service';
import { TourPublicService } from './tour-public.service';

const actor: AuthenticatedActor = {
  userId: 'user',
  sessionId: 'test',
  branchIds: ['branch-1'],
  permissions: [
    MANUAL_ACCESS_VERSION,
    'sales.contracts.create',
    'ui.screen.sales.new-contract',
    'ui.deny.ticket-catalog.home',
  ],
};
const search = {
  originId: '10000000-0000-4000-8000-000000000001',
  destinationId: '10000000-0000-4000-8000-000000000002',
  departureFrom: '2099-01-01',
};
describe('flight and tour selection without catalogue administration', () => {
  it('lets a Sales-only user search active offers scoped to their branches, but not manage them', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new TicketPublicService(
      { client: { ticketPublishedOffer: { findMany } } } as never,
      {} as never,
    );
    await expect(service.search(search, actor)).resolves.toMatchObject({
      data: [],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: { in: ['branch-1'] },
          status: 'ACTIVE',
          totalCapacity: { gt: 0 },
        }),
      }),
    );
    await expect(service.managed(actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.publish({} as never, actor, 'branch-1', 'key'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('does not turn an allowed screen, missing branches or revoked Sales permission into catalogue authority', async () => {
    const findMany = vi.fn();
    const service = new TicketPublicService(
      { client: { ticketPublishedOffer: { findMany } } } as never,
      {} as never,
    );
    for (const user of [
      { ...actor, branchIds: [] },
      {
        ...actor,
        permissions: [MANUAL_ACCESS_VERSION, 'ui.screen.sales.new-contract'],
      },
      {
        ...actor,
        permissions: [
          MANUAL_ACCESS_VERSION,
          'sales.contracts.create',
          'ui.deny.sales.new-contract',
          'ui.deny.sales.home',
        ],
      },
    ])
      await expect(
        service.search(search, user as AuthenticatedActor),
      ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });
  it('rejects a return offer outside the permitted branch even for an authorized Sales user', async () => {
    const findMany = vi.fn();
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new TicketPublicService(
      { client: { ticketPublishedOffer: { findMany, findFirst } } } as never,
      {} as never,
    );
    await expect(
      service.search({ ...search, outboundOfferId: search.originId }, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchId: { in: ['branch-1'] } }),
      }),
    );
    expect(findMany).not.toHaveBeenCalled();
  });
  it('allows branch-scoped departure selection, without opening package administration', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new TourPublicService(
      { client: { tourDeparture: { findMany } } } as never,
      {} as never,
    );
    await expect(service.departures(actor)).resolves.toMatchObject({
      data: [],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchId: { in: ['branch-1'] } }),
      }),
    );
    await expect(service.packages(actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
