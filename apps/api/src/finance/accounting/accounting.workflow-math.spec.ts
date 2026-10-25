import { describe, it, expect } from 'vitest';
import { revenueAmounts, settlementPortion } from './accounting.workflow-math';
import { importedGross } from '../../hr/accounting-payroll.public';
describe('evidenced accounting calculations', () => {
  it('preserves exact final FX residual and rejects over-settlement', () => {
    expect(settlementPortion('3', '100', '0', '0', '1', 0).toString()).toBe(
      '33',
    );
    expect(settlementPortion('3', '100', '1', '33', '1', 0).toString()).toBe(
      '34',
    );
    expect(settlementPortion('3', '100', '2', '67', '1', 0).toString()).toBe(
      '33',
    );
    expect(() => settlementPortion('3', '100', '2', '67', '2', 0)).toThrow();
  });
  it('distinguishes principal income and agent fee with source tax only', () => {
    const components = [
      { type: 'BASE', amount: '100.1234', currencyCode: 'USD' },
      { type: 'DISCOUNT', amount: '10', currencyCode: 'USD' },
      { type: 'TAX', amount: '9', currencyCode: 'USD' },
    ];
    expect(revenueAmounts(components, 'USD', 'PRINCIPAL')).toMatchObject({
      earned: '90.1234',
      gross: '99.1234',
      tax: '9',
    });
    expect(revenueAmounts(components, 'USD', 'AGENT', '5.1234')).toMatchObject({
      earned: '5.1234',
      gross: '5.1234',
      tax: '0',
      passThrough: '85',
    });
    expect(() => revenueAmounts(components, 'USD', 'AGENT', '91')).toThrow();
  });
  it('requires explicit unambiguous currency and gross minus actual deductions equals net', () => {
    const rows = [
      ['حقوق ناخالص', '۱۰۰'],
      ['کسورات', '۲۰'],
      ['خالص پرداختی', '۸۰'],
      ['ارز', 'IRR'],
    ].map((x, i) => ({
      id: String(i),
      version: 1,
      values: ['employee', '1405', '7', ...x],
    }));
    expect(importedGross(rows)).toMatchObject({
      gross: '100',
      deductions: '20',
      net: '80',
      currency: 'IRR',
    });
    expect(() => importedGross(rows.slice(0, 3))).toThrow();
    expect(() => importedGross([...rows, rows[0]!])).toThrow();
    expect(() =>
      importedGross(
        rows.map((r, i) =>
          i === 2
            ? { ...r, values: ['employee', '1405', '7', 'خالص پرداختی', '79'] }
            : r,
        ),
      ),
    ).toThrow();
  });
});
