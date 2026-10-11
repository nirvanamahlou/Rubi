import type { SalesContractSummary } from '@nora/contracts';
import { describe, expect, it } from 'vitest';
import { monthlySales, persianMonth } from './workbench-monthly-sales';

const now = new Date('2026-10-10T12:00:00.000Z');
const currentDay = persianMonth(now).day;
const currentStart = new Date(now.getTime() - (currentDay - 1) * 86_400_000);
const previousEnd = new Date(currentStart.getTime() - 86_400_000);
function row(
  id: string,
  createdAt: Date,
  status = 'CONFIRMED',
  amount = '10.25',
) {
  return {
    id,
    createdAt: createdAt.toISOString(),
    status,
    originId: 'THR',
    destinationId: 'KIH',
    originName: 'تهران',
    destinationName: 'کیش',
    passengerNames: ['یک', 'دو'],
    balances: [{ currencyCode: 'IRR', amount }],
  } as unknown as SalesContractSummary;
}

describe('Persian monthly sales', () => {
  it('separates the current and prior Persian months and excludes unconfirmed contracts', () => {
    const result = monthlySales(
      [
        row('a', now, 'CONFIRMED', '9007199254740993.10'),
        row('b', now, 'COMPLETED', '0.20'),
        row('draft', now, 'DRAFT', '500'),
        row('prior', previousEnd, 'CONFIRMED', '3'),
      ],
      now,
    );
    expect(result.current).toMatchObject({
      contracts: 2,
      people: 4,
      amounts: [{ currencyCode: 'IRR', amount: '9007199254740993.3' }],
    });
    expect(result.previous).toMatchObject({ contracts: 1, people: 2 });
    expect(result.routes).toMatchObject([
      { label: 'از تهران به کیش', contracts: 2, people: 4 },
    ]);
  });
});
