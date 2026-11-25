import { describe, expect, it, vi } from 'vitest';
import type { DatabaseClient } from '@nora/database';
import { readRollingSales, rollingSalesFilter } from './rolling-sales';

describe('rolling contractual sales', () => {
  it('keeps one shared Tehran cutoff and changes the start at local midnight', () => {
    for (const [end, start] of [
      ['2026-11-24T20:29:59.999Z', '2026-11-10T20:30:00.000Z'],
      ['2026-11-24T20:30:00.001Z', '2026-11-11T20:30:00.000Z'],
    ] as const) {
      expect(rollingSalesFilter(end)).toMatchObject({
        createdAt: { gte: new Date(start), lt: new Date(end) },
        confirmedAt: { lte: new Date(end) },
      });
    }
    expect(() => rollingSalesFilter('2026-02-31T20:30:00.000Z')).toThrow();
  });

  it('applies panel ownership, removes latest cancellations, sums discounted decimals separately, and counts before paging', async () => {
    const asOf = '2026-11-25T12:00:00.000Z';
    const rows = Array.from({ length: 13 }, (_, i) => ({
      id: String(i),
      contractNumber: 'n' + i,
      customerNameSnapshot: 'example',
      status: 'CONFIRMED',
      priceComponents:
        i === 0
          ? []
          : [
              {
                type: 'BASE',
                title: 'base',
                amount: '10.20',
                currencyCode: 'USD',
              },
              {
                type: 'DISCOUNT',
                title: 'discount',
                amount: '0.10',
                currencyCode: 'USD',
              },
              { type: 'TAX', title: 'tax', amount: '1', currencyCode: 'EUR' },
            ],
    }));
    const findMany = vi.fn().mockResolvedValue(rows);
    const tx = {
      $executeRaw: vi.fn(),
      salesContract: { findMany },
      reservationIntake: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              contractId: '1',
              workflowRevisions: [
                {
                  state: { supplierStatus: 'CANCELLED' },
                  createdAt: new Date(asOf),
                },
              ],
            },
          ]),
      },
    };
    const db = {
      $transaction: (f: (client: typeof tx) => Promise<unknown>) => f(tx),
    };
    const result = await readRollingSales(
      db as unknown as DatabaseClient,
      {
        mode: 'own',
        companyId: 'company',
        userId: 'actor',
        branchIds: ['branch'],
        payments: false,
      },
      asOf,
    );
    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({
      legalEntityId: 'company',
      hiddenAt: null,
      ownerUserId: 'actor',
      branchId: { in: ['branch'] },
      ...rollingSalesFilter(asOf),
    });
    expect(result.total).toBe(12);
    expect(result.rows).toHaveLength(10);
    expect(result.rows.map((row) => row.number)).not.toContain('n1');
    expect(result.missingAmounts).toBe(1);
    expect(
      result.totals.map((t) => [t.currencyCode, Number(t.amount)]),
    ).toEqual([
      ['EUR', 11],
      ['USD', 111.1],
    ]);
    expect(result.truncated).toBe(true);
  });
});
