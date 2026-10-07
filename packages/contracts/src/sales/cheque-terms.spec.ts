import { describe, expect, it } from 'vitest';
import {
  calculateSalesCheque,
  salesChequeMinimum,
  salesMonthlyDate,
  salesChequeComponents,
  validateSalesChequePayments,
  type SalesPaymentTerms,
} from './cheque-terms';
import { moneyUnits } from './pricing';
import type { SalesPaymentInput, SalesPriceComponentInput } from './index';

const base: SalesPriceComponentInput[] = [
  {
    type: 'BASE',
    title: 'خدمات سفر',
    currencyCode: 'IRR',
    amount: '100000000',
  },
];
const terms: SalesPaymentTerms = {
  version: 1,
  mode: 'CHECK',
  plans: [
    {
      currencyCode: 'IRR',
      downPayment: '30000000',
      months: 3,
      firstDueDate: '2026-11-30',
    },
  ],
};
function payments(): SalesPaymentInput[] {
  const plan = terms.plans[0]!;
  return [
    {
      method: 'BANK_TRANSFER',
      amount: plan.downPayment,
      currencyCode: 'IRR',
      dueAt: '2026-10-07',
    },
    ...calculateSalesCheque(base[0]!.amount, plan).schedule.map((row) => ({
      method: 'CHECK' as const,
      amount: row.amount,
      currencyCode: 'IRR',
      dueAt: row.dueDate,
      check: {
        bankId: '10000000-0000-4000-8000-000000000005',
        secureIdentifier: '123',
        ownerName: 'Test',
        dueDate: row.dueDate,
      },
    })),
  ];
}
describe('cash and cheque sale terms', () => {
  it('charges simple 5% monthly on the remaining principal only', () => {
    const result = calculateSalesCheque('100000000', terms.plans[0]!);
    expect(result.fee).toBe('10500000');
    expect(result.total).toBe('110500000');
    expect(result.schedule.map((row) => row.amount)).toEqual([
      '26833333',
      '26833333',
      '26833334',
    ]);
    expect(
      result.schedule.reduce((sum, row) => sum + moneyUnits(row.amount), 0n),
    ).toBe(moneyUnits('80500000'));
  });
  it('rejects below 30%, full down payment and unsupported terms', () => {
    expect(() =>
      calculateSalesCheque('100000000', {
        ...terms.plans[0]!,
        downPayment: '29999999.9999',
      }),
    ).toThrow('۳۰٪');
    expect(() =>
      calculateSalesCheque('100000000', {
        ...terms.plans[0]!,
        downPayment: '100000000',
      }),
    ).toThrow('۳۰٪');
    expect(() =>
      calculateSalesCheque('100', {
        ...terms.plans[0]!,
        downPayment: '30',
        months: 2 as 3,
      }),
    ).toThrow('طرح');
  });
  it('keeps anchored calendar month ends and leap dates', () => {
    expect(salesMonthlyDate('2028-01-31', 1)).toBe('2028-02-29');
    expect(salesMonthlyDate('2028-01-31', 2)).toBe('2028-03-31');
    expect(() => salesMonthlyDate('2026-02-30', 1)).toThrow();
  });
  it('rounds normal foreign payments to cents without losing the final remainder', () => {
    expect(salesChequeMinimum('123.45', 'USD')).toBe('37.04');
    const result = calculateSalesCheque('200.50', {
      ...terms.plans[0]!,
      currencyCode: 'USD',
      downPayment: '60.15',
    });
    expect(result.fee).toBe('21.05');
    expect(result.schedule.map((p) => p.amount)).toEqual([
      '53.8',
      '53.8',
      '53.8',
    ]);
  });
  it('rejects tampering with fee, down payment, cheque dates or amount', () => {
    const components = salesChequeComponents(base, terms);
    expect(() =>
      validateSalesChequePayments(components, payments(), terms),
    ).not.toThrow();
    expect(() => validateSalesChequePayments(base, payments(), terms)).toThrow(
      'کارمزد',
    );
    for (const patch of [
      { amount: '1' },
      { dueAt: '2026-12-01' },
      { check: { ...payments()[1]!.check!, dueDate: '2026-12-01' } },
    ]) {
      const rows = payments();
      rows[1] = { ...rows[1]!, ...patch };
      expect(() =>
        validateSalesChequePayments(components, rows, terms),
      ).toThrow('ماشین‌حساب');
    }
    const rows = payments();
    rows[0]!.amount = '1';
    expect(() => validateSalesChequePayments(components, rows, terms)).toThrow(
      'ماشین‌حساب',
    );
  });
  it('preserves legacy callers and never mixes currencies', () => {
    expect(salesChequeComponents(base)).toEqual(base);
    expect(() =>
      salesChequeComponents(
        [...base, { ...base[0]!, currencyCode: 'USD', amount: '100' }],
        terms,
      ),
    ).toThrow('ارز');
    expect(() =>
      validateSalesChequePayments(base, payments(), {
        version: 1,
        mode: 'CASH',
        plans: [],
      }),
    ).toThrow('نوع فروش');
  });
  it('accepts midnight Tehran dates stored in UTC and rejects incomplete cheque bank details', () => {
    const components = salesChequeComponents(base, terms);
    const rows = payments();
    rows[1]!.dueAt = '2026-11-29T20:30:00.000Z';
    expect(() =>
      validateSalesChequePayments(components, rows, terms),
    ).not.toThrow();
    rows[1]!.check!.bankId = '';
    expect(() => validateSalesChequePayments(components, rows, terms)).toThrow(
      'بانک',
    );
  });
});
