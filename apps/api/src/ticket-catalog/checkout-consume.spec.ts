import { describe, expect, it, vi } from 'vitest';
import { TicketPublicService } from './ticket-public.service';
import { checkoutQuoteFingerprint } from './checkout-hold-policy';

const branch = '10000000-0000-4000-8000-000000000001';
const contract = '10000000-0000-4000-8000-000000000002';
const offerId = '10000000-0000-4000-8000-000000000003';
const quote = { amount: '1000', currencyCode: 'IRR' };
function setup(change: Record<string, unknown> = {}, foreign = 0) {
  const hold = {
    id: 'hold',
    quantity: 1,
    status: 'ACTIVE',
    expiresAt: new Date(0),
    paymentPendingAt: new Date(),
    checkoutContractId: contract,
    checkoutQuoteFingerprint: checkoutQuoteFingerprint(quote),
    ...change,
  };
  const offer = {
    id: offerId,
    branchId: branch,
    status: 'ACTIVE',
    totalCapacity: 1,
    originId: branch,
    destinationId: contract,
    departureAt: new Date('2036-01-01T08:00:00Z'),
    arrivalAt: new Date('2036-01-01T10:00:00Z'),
    cabinClassCode: 'ECONOMY',
    carrierName: 'Synthetic',
    serviceNumber: 'TEST',
    saleRoutes: [],
    capacityAllocations: [],
    capacityHolds: [
      hold,
      ...(foreign
        ? [
            {
              ...hold,
              id: 'foreign',
              checkoutContractId: 'other',
              quantity: foreign,
            },
          ]
        : []),
    ],
  };
  const selection = {
    serviceClientKey: 'out',
    direction: 'OUTBOUND',
    offerId,
    originId: offer.originId,
    destinationId: offer.destinationId,
    departureAt: offer.departureAt.toISOString(),
    arrivalAt: offer.arrivalAt.toISOString(),
    cabinClassCode: offer.cabinClassCode,
    carrierNameSnapshot: offer.carrierName,
    serviceNumberSnapshot: offer.serviceNumber,
  };
  const allocations: unknown[] = [];
  const create = vi.fn(async ({ data }) => {
    const row = { id: 'allocation', status: 'ACTIVE', ...data };
    allocations.push(row);
    return row;
  });
  const consume = vi.fn().mockResolvedValue({ count: 1 });
  const reprice = vi.fn(() => {
    throw Error('frozen checkout must not reprice');
  });
  const tx = {
    $queryRaw: vi.fn(),
    ticketPublishedOffer: {
      findMany: vi.fn(async () => [
        { ...offer, capacityHolds: [...offer.capacityHolds] },
      ]),
    },
    ticketOfferCapacityAllocation: {
      findMany: vi.fn(async () => [...allocations]),
      create,
    },
    ticketOfferCapacityHold: { updateMany: consume },
    ticketSalePriceTarget: { findFirst: reprice },
  };
  const transaction = vi.fn(async (fn) => fn(tx));
  const service = new TicketPublicService(
    { client: { $transaction: transaction } } as never,
    {} as never,
  );
  const reserve = () =>
    service.reserve([selection] as never, branch, contract, 1, { out: quote });
  return { reserve, create, consume, reprice, transaction };
}
describe('native verified-checkout hold consumption', () => {
  it('converts own pinned last seat without double counting or repricing, then replays once', async () => {
    const f = setup();
    expect(await f.reserve()).toMatchObject({
      available: true,
      createdAllocationIds: ['allocation'],
    });
    expect(await f.reserve()).toMatchObject({
      available: true,
      createdAllocationIds: [],
    });
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(f.reprice).not.toHaveBeenCalled();
    expect(f.consume).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CONSUMED' }),
      }),
    );
    expect(f.transaction).toHaveBeenCalledTimes(2);
  });
  it('counts foreign held demand and makes no partial allocation', async () => {
    const f = setup({}, 1);
    expect(await f.reserve()).toMatchObject({
      available: false,
      createdAllocationIds: [],
    });
    expect(f.create).not.toHaveBeenCalled();
    expect(f.consume).not.toHaveBeenCalled();
  });
  it.each([
    { quantity: 2 },
    { status: 'RELEASED' },
    { paymentPendingAt: null },
    { checkoutQuoteFingerprint: 'mismatch' },
  ])('rejects invalid own lease %j before any mutation', async (change) => {
    const f = setup(change);
    await expect(f.reserve()).rejects.toThrow();
    expect(f.create).not.toHaveBeenCalled();
    expect(f.consume).not.toHaveBeenCalled();
  });
});
