import { describe, expect, it, vi } from 'vitest';
import { assertUniqueTicketIdentity } from './ticket-offer-identity';

const offer = {
  originId: 'origin',
  destinationId: 'destination',
  departureAt: '2099-01-01T10:00:00Z',
  arrivalAt: '2099-01-01T12:00:00Z',
  carrierName: 'Test Airline',
  serviceNumber: 'QA-1',
  cabinClassCode: 'ECONOMY' as const,
  totalCapacity: 50,
};
function setup(rows: unknown[] = []) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    ticketPublishedOffer: { findMany: vi.fn().mockResolvedValue(rows) },
  };
  return tx;
}
describe('dated flight identity', () => {
  it('locks before checking identity and scopes by branch, cabin/date and unarchived records', async () => {
    const tx = setup();
    await assertUniqueTicketIdentity(tx as never, offer, 'branch', 'self');
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.ticketPublishedOffer.findMany.mock.invocationCallOrder[0]!,
    );
    expect(tx.ticketPublishedOffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: 'branch',
          cabinClassCode: 'ECONOMY',
          departureAt: new Date(offer.departureAt),
          id: { not: 'self' },
          audit: { none: { action: 'ticket.offer.archived' } },
        }),
      }),
    );
  });
  it.each([
    {},
    { totalCapacity: 60 },
    { arrivalAt: '2099-01-01T13:00:00Z' },
    { supplyType: 'COMPANY' as const },
  ])('rejects a new key or capacity/arrival-only copy (%j)', async (patch) => {
    const tx = setup([
      {
        carrierName: ' test   AIRLINE ',
        serviceNumber: 'qa-1',
        supplyType: null,
      },
    ]);
    await expect(
      assertUniqueTicketIdentity(tx as never, { ...offer, ...patch }, 'branch'),
    ).rejects.toThrow('قبلاً ثبت');
  });
  it('allows a different service, carrier or supply source', async () => {
    for (const row of [
      { carrierName: 'Other', serviceNumber: 'QA-1' },
      { carrierName: 'Test Airline', serviceNumber: 'QA-2' },
      { carrierName: 'Test Airline', serviceNumber: 'QA-1', supplyType: 'API' },
    ]) {
      await expect(
        assertUniqueTicketIdentity(setup([row]) as never, offer, 'branch'),
      ).resolves.toBeUndefined();
    }
  });
});
