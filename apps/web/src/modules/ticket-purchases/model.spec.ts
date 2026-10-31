import { it, expect } from 'vitest';
import type { TicketPurchaseInboxItemV1 } from '@nora/contracts';
import { purchaseSummary } from './model';
it('summarizes stages and exact separate-currency actual purchase/payment totals', () => {
  const row = (
    stage: string,
    code: string,
    invoice: string,
    paid: string,
    remaining: string,
  ) =>
    ({
      stage,
      cost: {
        currencyCode: code,
        invoiceAmount: invoice,
        paidAmount: paid,
        remainingAmount: remaining,
      },
    }) as TicketPurchaseInboxItemV1;
  const result = purchaseSummary([
    { stage: 'UNPRICED', cost: null } as TicketPurchaseInboxItemV1,
    row('PAYING', 'USD', '2510.002', '1000', '1510.002'),
    row('PAID', 'USD', '100.0001', '100.0001', '0'),
    row(
      'READY_FOR_PAYMENT',
      'IRR',
      '9007199254740993.0001',
      '0',
      '9007199254740993.0001',
    ),
  ]);
  expect(result).toMatchObject({
    unpriced: 1,
    pending: 2,
    paid: 1,
    totals: [
      {
        currencyCode: 'USD',
        invoice: '2610.0021',
        paid: '1100.0001',
        remaining: '1510.002',
      },
      { currencyCode: 'IRR', invoice: '9007199254740993.0001' },
    ],
  });
});

import {
  groupTicketPurchases,
  separateTicketPurchases,
  ticketPurchaseEditRow,
  canEditTicketPurchase,
} from './model';
function groupedRow(id: string, key = 'monday', day = '2026-10-05') {
  return {
    request: { id, seatCount: 50, serviceDate: day, status: 'PENDING' },
    flightGroup: { key, weekday: 1, flightNumber: '9740' },
    cost: null,
    stage: 'UNPRICED',
  } as TicketPurchaseInboxItemV1;
}
it('keeps each defined flight separate even with identical weekday and flight number', () => {
  const a = groupedRow('a'),
    b = groupedRow('b', 'monday', '2026-10-12'),
    c = groupedRow('c', 'friday'),
    d = groupedRow('d');
  delete d.flightGroup;
  const groups = groupTicketPurchases([a, b, c, d]);
  expect(groups.map((g) => g.request.seatCount)).toEqual([50, 50, 50, 50]);
  expect(groups[0]!.dates).toEqual(['2026-10-05']);
  expect(groups[1]!.dates).toEqual(['2026-10-12']);
  expect(
    separateTicketPurchases([a, b, c, d]).map((row) => row.request.id),
  ).toEqual(['a', 'b', 'c', 'd']);
  expect(groupTicketPurchases([a, b], [a])[0]!.request.seatCount).toBe(50);
});
it('never truncates a saved pool through a date filter and sums its payment evidence exactly once', () => {
  const [a, b] = [groupedRow('a'), groupedRow('b')];
  for (const m of [a!, b!]) {
    m.cost = {
      id: m.request.id,
      version: 1,
      seatCount: 50,
      unitCost: '10',
      invoiceAmount: '500',
      currencyCode: 'USD',
      paidAmount: '100',
      remainingAmount: '400',
      paymentCount: 1,
      purchaseGroup: { id: 'saved', seatCount: 100, totalCost: '1000' },
    };
    m.stage = 'PAYING';
  }
  const group = groupTicketPurchases([a!, b!], [a!])[0]!;
  expect(group.members).toHaveLength(2);
  expect(group.cost).toMatchObject({
    seatCount: 100,
    invoiceAmount: '1000',
    paidAmount: '200',
    remainingAmount: '800',
    paymentCount: 2,
  });
  expect(purchaseSummary([group]).totals[0]!.invoice).toBe('1000');
  const individual = separateTicketPurchases([a!, b!]);
  expect(individual).toHaveLength(2);
  expect(individual.map((row) => row.cost?.invoiceAmount)).toEqual([
    '500',
    '500',
  ]);
  expect(purchaseSummary(individual).totals[0]!.invoice).toBe('1000');
  const edit = ticketPurchaseEditRow([a!, b!], a!);
  expect(edit.members).toHaveLength(2);
  expect(canEditTicketPurchase(edit, true)).toBe(false);
  for (const row of [a!, b!]) row.cost!.paymentCount = 0;
  expect(canEditTicketPurchase(ticketPurchaseEditRow([a!, b!], a!), true)).toBe(
    true,
  );
});
it('keeps final unsold loss separate from remaining future capacity inside a recurring group', () => {
  const a = groupedRow('a'),
    b = groupedRow('b');
  a.capacityCost = {
    purchasedSeats: 50,
    allocatedSeats: 40,
    unsoldSeats: 10,
    amount: '100',
    currencyCode: 'USD',
    status: 'FINAL_LOSS',
  };
  b.capacityCost = { ...a.capacityCost, status: 'REMAINING_CAPACITY' };
  expect(
    separateTicketPurchases([a, b]).flatMap((row) =>
      row.capacityCosts.map((c) => c.status),
    ),
  ).toEqual(['FINAL_LOSS', 'REMAINING_CAPACITY']);
});

it('reopens the exact flight cost for editing while preserving permissions and paid locks', () => {
  const a = groupedRow('a'),
    b = groupedRow('b');
  const edit = ticketPurchaseEditRow([a, b], b);
  expect(edit.request.id).toBe('b');
  expect(edit.members).toHaveLength(1);
  expect(canEditTicketPurchase(edit, true)).toBe(true);
  expect(canEditTicketPurchase(edit, false)).toBe(false);
  b.request.status = 'PAID';
  expect(canEditTicketPurchase(edit, true)).toBe(false);
});
