import { expect, it } from 'vitest';
import type { FloatingTourSaleSet } from '@nora/contracts';
import {
  changeFloatingPeriod,
  readFloatingPeriodChange,
} from './floating-period-change';
import { floatingWebsitePeriods } from './floating-tour-publication';

function catalog(): FloatingTourSaleSet {
  const row = {
    sourceRows: [2],
    startsOn: '2027-01-01',
    endsOn: '2027-01-08',
    nights: 7,
    stays: [],
    prices: {
      double: [
        { currency: 'EUR' as const, amount: '100.01' },
        { currency: 'IRR' as const, amount: '500000' },
      ],
    },
    commission: [{ currency: 'EUR' as const, amount: '10' }],
  };
  return {
    version: 3,
    dated: [row, { ...structuredClone(row), startsOn: '2027-02-01' }],
    monthly: {
      calendar: 'GREGORIAN',
      months: [3],
      rows: [{ ...structuredClone(row), startsOn: null, endsOn: null }],
    },
  };
}
const base = { expectedVersion: 3, periodKey: 'dated:2027-01-01:7' };
it('adjusts only one period exactly and leaves commissions and the original untouched', () => {
  const original = catalog();
  const next = changeFloatingPeriod(original, {
    ...base,
    action: 'ADJUST',
    adjustment: { mode: 'PERCENT', direction: 'INCREASE', amount: '10' },
  });
  expect(next.dated[0]?.prices.double?.map((p) => p.amount)).toEqual([
    '110.0110',
    '550000.0000',
  ]);
  expect(next.dated[0]?.commission).toEqual(original.dated[0]?.commission);
  expect(next.dated[1]).toEqual(original.dated[1]);
  expect(next.monthly).toEqual(original.monthly);
  expect(original.dated[0]?.prices.double?.[0]?.amount).toBe('100.01');
  expect(next.version).toBe(4);
});
it('adjusts only the selected currency and rejects negative resulting prices', () => {
  const adjustment = {
    mode: 'FIXED' as const,
    direction: 'DECREASE' as const,
    amount: '1.01',
    currency: 'EUR' as const,
  };
  const next = changeFloatingPeriod(catalog(), {
    ...base,
    action: 'ADJUST',
    adjustment,
  });
  expect(next.dated[0]?.prices.double?.map((p) => p.amount)).toEqual([
    '99.0000',
    '500000',
  ]);
  expect(() =>
    changeFloatingPeriod(catalog(), {
      ...base,
      action: 'ADJUST',
      adjustment: { ...adjustment, amount: '101' },
    }),
  ).toThrow();
});
it('stops publication and resumes without deleting prices', () => {
  const stopped = changeFloatingPeriod(catalog(), { ...base, action: 'STOP' });
  expect(floatingWebsitePeriods(stopped).map((p) => p.key)).not.toContain(
    base.periodKey,
  );
  expect(stopped.dated[0]?.prices).toEqual(catalog().dated[0]?.prices);
  const resumed = changeFloatingPeriod(stopped, { ...base, action: 'RESUME' });
  expect(floatingWebsitePeriods(resumed).map((p) => p.key)).toContain(
    base.periodKey,
  );
});
it('deletes dated and monthly periods independently', () => {
  const next = changeFloatingPeriod(catalog(), { ...base, action: 'DELETE' });
  expect(next.dated).toHaveLength(1);
  expect(next.monthly).not.toBeNull();
  const removed = changeFloatingPeriod(next, {
    ...base,
    periodKey: 'monthly:GREGORIAN:3:7',
    action: 'DELETE',
  });
  expect(removed.monthly).toBeNull();
  expect(removed.dated).toEqual(next.dated);
});
it('allows manual amounts but rejects another period index or currency changes', () => {
  const prices = {
    double: [
      { currency: 'EUR' as const, amount: '200' },
      { currency: 'IRR' as const, amount: '500000' },
    ],
  };
  expect(
    changeFloatingPeriod(catalog(), {
      ...base,
      action: 'EDIT',
      rows: [{ index: 0, prices }],
    }).dated[0]?.prices,
  ).toEqual(prices);
  expect(() =>
    changeFloatingPeriod(catalog(), {
      ...base,
      action: 'EDIT',
      rows: [{ index: 1, prices }],
    }),
  ).toThrow();
  expect(() =>
    changeFloatingPeriod(catalog(), {
      ...base,
      action: 'EDIT',
      rows: [{ index: 0, prices: {} }],
    }),
  ).toThrow();
});
it('validates action-specific input, finite nonnegative money, and unique rows', () => {
  expect(readFloatingPeriodChange({ ...base, action: 'STOP' }).action).toBe(
    'STOP',
  );
  for (const input of [
    { ...base, action: 'ADJUST' },
    {
      ...base,
      action: 'EDIT',
      rows: [
        { index: 0, prices: { double: [{ currency: 'EUR', amount: '-1' }] } },
      ],
    },
    { ...base, action: 'STOP', rows: [] },
    { ...base, expectedVersion: '3', action: 'STOP' },
  ])
    expect(() => readFloatingPeriodChange(input)).toThrow();
});
