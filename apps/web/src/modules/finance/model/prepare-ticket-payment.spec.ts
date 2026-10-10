import { expect, it, vi } from 'vitest';
import type { FinanceInboxItemV1 } from '@nora/contracts';
import { prepareTicketPayment } from './prepare-ticket-payment';
const item = {
  sourceReference: 'request',
  sourceContextReference: 'old',
  sourceVersion: 1,
  amount: null,
  ticketPurchase: { seatCount: null, unitCost: null, paymentCount: 0 },
} as FinanceInboxItemV1;
const draft = { seatCount: '3', unitCost: '10.1234', currencyCode: 'USD' };
it('prepares price in the payment flow and reuses its accepted revision on retries', async () => {
  const record = vi.fn().mockResolvedValue({
    data: {
      id: 'revision',
      version: 2,
      invoiceAmount: '30.3702',
      currencyCode: 'USD',
      seatCount: 3,
      unitCost: '10.1234',
    },
  });
  const prepared = await prepareTicketPayment(item, draft, record);
  expect(record).toHaveBeenCalledWith('request', {
    version: 1,
    seatCount: 3,
    unitCost: '10.1234',
    currencyCode: 'USD',
  });
  expect(prepared.sourceContextReference).toBe('revision');
  expect(prepared.amount).toEqual({ amount: '30.3702', currencyCode: 'USD' });
  expect(await prepareTicketPayment(prepared, draft, record)).toBe(prepared);
  expect(record).toHaveBeenCalledTimes(1);
});
it('never changes a cost after payment started and rejects incomplete input before saving', async () => {
  const record = vi.fn();
  const paid = {
    ...item,
    ticketPurchase: { seatCount: 3, unitCost: '10', paymentCount: 1 },
  };
  expect(await prepareTicketPayment(paid, draft, record)).toBe(paid);
  await expect(
    prepareTicketPayment(item, { ...draft, seatCount: '0' }, record),
  ).rejects.toThrow();
  expect(record).not.toHaveBeenCalled();
});
it('stops before payment preparation when recording cost fails', async () => {
  const record = vi.fn().mockRejectedValue(new Error('cost failed'));
  await expect(prepareTicketPayment(item, draft, record)).rejects.toThrow(
    'cost failed',
  );
});
