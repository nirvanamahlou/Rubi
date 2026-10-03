import { it, expect, vi } from 'vitest';
import { Prisma } from '@nora/database';
import { SalesReservationTableService } from './sales-reservation-table.module';
const decimal = (n: string) => new Prisma.Decimal(n);
function setup() {
  const record = {
    id: 'c',
    version: 5,
    status: 'CANCELLED',
    cancelledAt: new Date('2026-09-30T10:00:00Z'),
    createdAt: new Date('2026-09-01T10:00:00Z'),
    departureDate: new Date('2026-10-01'),
    returnNotBefore: new Date('2026-10-03'),
    hotelSelection: null,
    ticketSelections: [],
    auditEvents: [{ occurredAt: new Date('2026-09-20T10:00:00Z') }],
    passengers: ['2025-10-01', '2024-10-01', '2020-10-01', '2014-10-01'].map(
      (d) => ({ birthDate: new Date(d) }),
    ),
    priceComponents: [
      {
        type: 'BASE',
        title: 'Rial',
        currencyCode: 'IRR',
        amount: decimal('1000'),
      },
      {
        type: 'DISCOUNT',
        title: 'Discount',
        currencyCode: 'IRR',
        amount: decimal('100'),
      },
      {
        type: 'BASE',
        title: 'USD',
        currencyCode: 'USD',
        amount: decimal('200'),
      },
    ],
    payments: [
      {
        status: 'FINANCE_CONFIRMED',
        currencyCode: 'IRR',
        amount: decimal('300'),
      },
      {
        status: 'PENDING_FINANCE_CONFIRMATION',
        currencyCode: 'USD',
        amount: decimal('20'),
      },
    ],
  };
  const findMany = vi.fn().mockResolvedValue([record]);
  const tickets = { reservationCommissions: vi.fn().mockResolvedValue([]) };
  return {
    findMany,
    tickets,
    service: new SalesReservationTableService(
      { client: { salesContract: { findMany } } } as never,
      tickets as never,
    ),
  };
}
it('keeps currency balances separate, finance-confirmed debt and exact age boundaries', async () => {
  const s = setup();
  const result = await s.service.read(['c'], {
    permissions: ['reservations.read', 'sales.payments.read'],
    branchIds: ['b'],
  } as never);
  expect(result.get('c')).toMatchObject({
    saleRial: '900',
    saleForeign: '200 USD',
    debtRial: '600',
    debtForeign: '200 USD',
    adults: 1,
    children6To12: 1,
    children2To6: 1,
    infants: 1,
    passengerCount: 4,
    returnDate: null,
  });
  expect(s.findMany.mock.calls[0]?.[0].where.branchId).toEqual({ in: ['b'] });
});
it('does not project debt without financial permission or query without reservation permission', async () => {
  const s = setup();
  expect(
    (
      await s.service.read(['c'], {
        permissions: ['reservations.read'],
        branchIds: ['b'],
      } as never)
    ).get('c')?.debtRial,
  ).toBeNull();
  s.findMany.mockClear();
  expect(
    (
      await s.service.read(['c'], {
        permissions: [],
        branchIds: ['b'],
      } as never)
    ).size,
  ).toBe(0);
  expect(s.findMany).not.toHaveBeenCalled();
});
