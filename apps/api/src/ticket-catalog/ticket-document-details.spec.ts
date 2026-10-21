import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { ProcurementPublicService } from '../procurement/procurement-public.service';
import type { MasterDataService } from '../master-data/master-data.service';
import {
  TicketPublicService,
  validateTicketOffer,
} from './ticket-public.service';
const id = '11111111-1111-4111-8111-111111111111';
const actor = {
  permissions: ['ticket_catalog.read', 'ticket_catalog.manage'],
  branchIds: [id],
  userId: id,
} as unknown as AuthenticatedActor;
const input = {
  originId: id,
  destinationId: '22222222-2222-4222-8222-222222222222',
  originAirportId: '33333333-3333-4333-8333-333333333333',
  departureAt: '2099-01-01T10:00:00Z',
  arrivalAt: '2099-01-01T12:00:00Z',
  carrierName: 'Synthetic',
  serviceNumber: '1',
  cabinClassCode: 'ECONOMY' as const,
  totalCapacity: 10,
};
function fixture() {
  const findFirst = vi.fn().mockResolvedValue({
    id,
    originId: id,
    destinationId: input.destinationId,
    originAirportId: input.originAirportId,
    destinationAirportId: null,
    economyBaggageKg: { toString: () => '20' },
    businessBaggageKg: { toString: () => '30' },
  });
  const upsert = vi
    .fn()
    .mockImplementation(
      async ({ create }: { create: Record<string, unknown> }) => ({
        ...create,
        id,
        version: 1,
      }),
    );
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    ticketPublishedOffer: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      upsert,
    },
  };
  const detail = vi.fn().mockResolvedValue({
    data: { status: 'active', attributes: { cityId: id } },
  });
  const service = new TicketPublicService(
    {
      client: {
        ticketPublishedOffer: { findFirst, upsert },
        $transaction: (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      },
    } as unknown as DatabaseService,
    {
      ensureOfferPurchaseRequest: vi.fn(),
    } as unknown as ProcurementPublicService,
    undefined,
    { detail } as unknown as MasterDataService,
  );
  return { service, findFirst, upsert, detail };
}
describe('ticket selected airport document projection', () => {
  it('allows Reservations readers to obtain only same-branch document facts without granting fare or management access', async () => {
    const s = fixture();
    const reader = {
      ...actor,
      permissions: ['reservations.read'],
    } as AuthenticatedActor;
    expect(
      (await s.service.documentDetails(id, reader)).data.originAirportId,
    ).toBe(input.originAirportId);
    expect(s.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id, branchId: { in: [id] } },
        select: {
          id: true,
          originId: true,
          destinationId: true,
          originAirportId: true,
          destinationAirportId: true,
          economyBaggageKg: true,
          businessBaggageKg: true,
          saleRoutes: { select: { originId: true, destinationId: true } },
        },
      }),
    );
    await expect(
      s.service.publish(input, reader, id, 'forbidden'),
    ).rejects.toThrow();
    s.findFirst.mockResolvedValue(null);
    await expect(
      s.service.documentDetails(id, { ...reader, branchIds: ['other'] }),
    ).rejects.toThrow();
  });
  it('accepts additive optional airport IDs and rejects malformed references', () => {
    expect(validateTicketOffer(input).originAirportId).toBe(
      input.originAirportId,
    );
    expect(() =>
      validateTicketOffer({ ...input, originAirportId: 'wrong' }),
    ).toThrow();
  });
  it('reads only minimal ticket facts inside the actor branch', async () => {
    const { service, findFirst } = fixture();
    const result = await service.documentDetails(id, actor);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id, branchId: { in: [id] } } }),
    );
    expect(result.data.economyBaggageKg).toBe('20');
    expect(result.data.businessBaggageKg).toBe('30');
    expect(result.data.originAirportId).toBe(input.originAirportId);
  });
  it('rejects unauthorized or unknown offers before exposing metadata', async () => {
    const { service, findFirst } = fixture();
    await expect(
      service.documentDetails(id, { ...actor, permissions: [] }),
    ).rejects.toThrow();
    expect(findFirst).not.toHaveBeenCalled();
    await expect(service.documentDetails('bad', actor)).rejects.toThrow();
    findFirst.mockResolvedValue(null);
    await expect(service.documentDetails(id, actor)).rejects.toThrow();
  });
  it('allows an active airport in another city without replacing the commercial route', async () => {
    const { service, upsert, detail } = fixture();
    detail.mockResolvedValue({
      data: { status: 'active', attributes: { cityId: 'other' } },
    });
    await expect(
      service.publish(input, actor, id, 'synthetic-key'),
    ).resolves.toBeDefined();
    expect(upsert).toHaveBeenCalled();
    detail.mockResolvedValue({
      data: { status: 'inactive', attributes: { cityId: 'other' } },
    });
    await expect(
      service.publish(input, actor, id, 'another-key'),
    ).rejects.toThrow('فرودگاه');
  });
});

it('allows a Sales reader the same minimal branch-scoped document projection', async () => {
  const s = fixture();
  await expect(
    s.service.documentDetails(id, {
      ...actor,
      permissions: ['sales.contracts.read.own'],
    }),
  ).resolves.toBeDefined();
  s.findFirst.mockResolvedValue(null);
  await expect(
    s.service.documentDetails(id, {
      ...actor,
      permissions: ['sales.contracts.read.own'],
      branchIds: ['other'],
    }),
  ).rejects.toThrow();
});
