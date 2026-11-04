import { describe, expect, it } from 'vitest';
import type { AccountingReportRowV1 } from '@nora/contracts';
import { trialBalanceTable } from './accounting.trial-balance';
const row = {
  accountId: 'a',
  code: 'test',
  title: 'Synthetic',
  priorDebit: '100',
  priorCredit: '40',
  opening: '60',
  debit: '5',
  credit: '15',
  balance: '50',
};
describe('source trial balance presentation', () => {
  it('distinguishes period balance from cumulative balance and preserves gross prior movement', () => {
    expect(trialBalanceTable([row], '2').rows[0]!.values.slice(2)).toEqual([
      '0',
      '10',
    ]);
    expect(trialBalanceTable([row], '4').rows[0]!.values.slice(2)).toEqual([
      '5',
      '15',
      '0',
      '10',
    ]);
    expect(trialBalanceTable([row], '6').rows[0]!.values.slice(2)).toEqual([
      '100',
      '40',
      '5',
      '15',
      '50',
      '0',
    ]);
    expect(trialBalanceTable([row], '8').rows[0]!.values.slice(2)).toEqual([
      '100',
      '40',
      '5',
      '15',
      '105',
      '55',
      '50',
      '0',
    ]);
  });
  it('filters on the selected balance and totals only the displayed accounts', () => {
    expect(trialBalanceTable([row], '4', 'DEBIT').rows).toEqual([]);
    expect(trialBalanceTable([row], '6', 'DEBIT').totals.slice(2)).toEqual([
      '100',
      '40',
      '5',
      '15',
      '50',
      '0',
    ]);
    expect(trialBalanceTable([row], '6', 'CREDIT').rows).toEqual([]);
    expect(
      trialBalanceTable([{ ...row, debit: '15' }], '4', 'ZERO').rows,
    ).toHaveLength(1);
    expect(
      trialBalanceTable([{ ...row, debit: '15' }], '4', 'NONZERO').rows,
    ).toHaveLength(0);
  });
  it('never uses floating point or infers gross amounts from the opening net', () => {
    expect(
      trialBalanceTable(
        [{ ...row, debit: '9007199254740993.123456789012345678', credit: '0' }],
        '8',
      ).rows[0]!.values[6],
    ).toBe('9007199254741093.123456789012345678');
    const legacy: AccountingReportRowV1 = { ...row };
    delete legacy.priorDebit;
    delete legacy.priorCredit;
    expect(() => trialBalanceTable([legacy], '6')).toThrow();
    expect(() => trialBalanceTable([row], '10')).toThrow();
    expect(() => trialBalanceTable([row], '4', 'unknown')).toThrow();
  });
});
