import { describe, it, expect, vi } from 'vitest';
import { SalesRepository } from './sales.repository';
import type { SalesContractCreateRequest } from '@nora/contracts';
const input = {
  customerId: 'customer',
  tripType: 'ONE_WAY',
  originId: 'a',
  destinationId: 'b',
  departureDate: '2099-01-01',
  services: [],
  passengers: [],
  priceComponents: [],
} as SalesContractCreateRequest;
function setup(count = 1) {
  const remove = { deleteMany: vi.fn() };
  const tx = {
    salesContract: {
      updateMany: vi.fn(async (_input: unknown) => {
        void _input;
        return { count };
      }),
    },
    salesContractHotelSelection: { ...remove },
    salesContractTicketSelection: { ...remove },
    salesPassengerServiceAllocation: { ...remove },
    salesContractPassenger: { ...remove },
    salesContractService: { ...remove },
    salesContractPriceComponent: { ...remove, createMany: vi.fn() },
    salesContractAuditEvent: { create: vi.fn() },
    salesReservationRequest: { create: vi.fn() },
  };
  const db = {
    client: {
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
  return { tx, repository: new SalesRepository(db as never) };
}
const amendment = {
  categories: {},
  snapshot: { version: 1 },
  requestId: 'request',
  reason: 'Synthetic',
  before: { version: 2 },
  reserve: vi.fn(async () => {}),
};
describe('contract amendment transaction', () => {
  it('writes the versioned outbox in the same transaction without replacing payments', async () => {
    const { tx, repository } = setup();
    await expect(
      repository.updateDraft(
        'id',
        input,
        2,
        'Synthetic',
        { userId: 'u', branchId: 'b' },
        amendment,
      ),
    ).resolves.toBe(true);
    expect(amendment.reserve).toHaveBeenCalledWith(tx);
    expect(tx.salesReservationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contractVersion: 3,
          createdByUserId: 'u',
        }),
      }),
    );
    expect(tx.salesContract.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          version: 2,
          status: { not: 'CANCELLED' },
        }),
      }),
    );
  });
  it('stale versions cannot change capacity, children or audit', async () => {
    const { tx, repository } = setup(0);
    const reserve = vi.fn();
    expect(
      await repository.updateDraft(
        'id',
        input,
        2,
        'Synthetic',
        { userId: 'u', branchId: 'b' },
        { ...amendment, reserve },
      ),
    ).toBe(false);
    expect(reserve).not.toHaveBeenCalled();
    expect(tx.salesContractService.deleteMany).not.toHaveBeenCalled();
    expect(tx.salesReservationRequest.create).not.toHaveBeenCalled();
  });
  it('capacity failure aborts before replacing contract children or emitting outbox', async () => {
    const { tx, repository } = setup();
    await expect(
      repository.updateDraft(
        'id',
        input,
        2,
        'Synthetic',
        { userId: 'u', branchId: 'b' },
        {
          ...amendment,
          reserve: async () => {
            throw Error('full');
          },
        },
      ),
    ).rejects.toThrow('full');
    expect(tx.salesContractService.deleteMany).not.toHaveBeenCalled();
    expect(tx.salesReservationRequest.create).not.toHaveBeenCalled();
  });
  it('price-only correction leaves operational queue untouched', async () => {
    const { tx, repository } = setup();
    await repository.updateDraft(
      'id',
      input,
      2,
      'Synthetic',
      { userId: 'u', branchId: 'b' },
      { ...amendment, snapshot: undefined },
    );
    expect(tx.salesReservationRequest.create).not.toHaveBeenCalled();
    expect(tx.salesContract.updateMany.mock.calls[0]?.[0]).not.toHaveProperty(
      'data.reservationStatus',
    );
  });
});
