import { describe, it, expect } from 'vitest';
import { journalDisplayTotals } from './accounting-money';
describe('accounting display totals', () => {
  it('retains exact large amounts and Persian grouping', () =>
    expect(
      journalDisplayTotals([
        { debit: '۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۳', credit: '0' },
        { debit: '0', credit: '9007199254740993' },
      ]).balanced,
    ).toBe(true));
  it('shows an exact signed difference and rejects malformed grouping', () => {
    expect(
      journalDisplayTotals([{ debit: '0.01', credit: '0.02' }]).difference,
    ).toBe('-0.01');
    expect(journalDisplayTotals([{ debit: '1,2', credit: '0' }]).valid).toBe(
      false,
    );
  });
});
