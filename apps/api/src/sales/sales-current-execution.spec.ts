import { expect, it, vi } from 'vitest';
import { currentSalesExecution } from './sales-current-execution';
import { presentSalesContract } from './sales.service';
import type { SalesReservationRequestV1 } from '@nora/contracts';
vi.mock('./sales.service', () => ({ presentSalesContract: vi.fn() }));
const snapshot = {
  contractId: 'contract',
  requestId: 'old-request',
  contractVersion: 1,
} as SalesReservationRequestV1;
it('projects current branch-scoped contract facts without replacing historical request identity', async () => {
  const tx = {
    salesContract: {
      findFirst: vi.fn().mockResolvedValue({ status: 'SENT_TO_RESERVATIONS' }),
    },
  };
  vi.mocked(presentSalesContract).mockReturnValue({
    version: 7,
    contractNumber: 'NEW',
    customerId: 'buyer',
    passengersDetail: [
      {
        customerId: 'p',
        displayNameSnapshot: 'NEW NAME',
        ageCategory: 'CHD',
        childAgeBand: 'AGE_2_6',
        serviceClientKeys: ['hotel'],
      },
    ],
    servicesDetail: [{ clientKey: 'hotel' }],
    ticketSelections: [{ offerId: 'new-flight' }],
    hotelSelection: { hotelNameSnapshot: 'NEW HOTEL' },
  } as never);
  const result = await currentSalesExecution(tx as never, snapshot, ['branch']);
  expect(tx.salesContract.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'contract', branchId: { in: ['branch'] } },
    }),
  );
  expect(result).toMatchObject({
    requestId: 'old-request',
    contractVersion: 7,
    passengerIds: ['p'],
    selectedTicketOfferIds: ['new-flight'],
    hotelSelection: { hotelNameSnapshot: 'NEW HOTEL' },
  });
  expect(snapshot.contractVersion).toBe(1);
});
it('denies missing and cancelled contracts instead of falling back to stale output', async () => {
  const findFirst = vi
    .fn()
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ status: 'CANCELLED' });
  const tx = { salesContract: { findFirst } };
  await expect(
    currentSalesExecution(tx as never, snapshot, ['other']),
  ).rejects.toThrow('دسترس');
  await expect(
    currentSalesExecution(tx as never, snapshot, ['branch']),
  ).rejects.toThrow('ابطال');
});
