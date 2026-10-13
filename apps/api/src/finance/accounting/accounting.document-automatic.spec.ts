import { describe, it, expect } from 'vitest';
import { automaticTransferPair } from './accounting.document-automatic';
const source = {
  accountId: 'source',
  detail4Id: 'd4',
  detail5Id: null,
  detail6Id: null,
};
const target = { ...source, accountId: 'target' };
describe('source automatic balance transfer', () => {
  it('reverses a debit source balance and transfers only the configured percentage', () => {
    const rows = automaticTransferPair(
      '123.45',
      '25',
      2,
      source,
      target,
      'Transfer',
    );
    expect(rows.map((row) => [row.debit, row.credit])).toEqual([
      ['0', '30.86'],
      ['30.86', '0'],
    ]);
    expect(rows[0]?.detail4Id).toBe('d4');
  });
  it('reverses credit balances and preserves decimals beyond Number precision', () => {
    const rows = automaticTransferPair(
      '-9007199254740993.99',
      '100',
      2,
      source,
      target,
      'Transfer',
    );
    expect(rows.map((row) => [row.debit, row.credit])).toEqual([
      ['9007199254740993.99', '0'],
      ['0', '9007199254740993.99'],
    ]);
  });
  it('skips amounts that round to zero at the actual currency precision', () => {
    expect(
      automaticTransferPair('0.1', '25', 0, source, target, 'Transfer'),
    ).toEqual([]);
  });
  it('rejects invalid target percentages and unsupported currency precision', () => {
    for (const percent of ['0', '0.99', '101'])
      expect(() =>
        automaticTransferPair('100', percent, 2, source, target, 'Transfer'),
      ).toThrow();
    expect(() =>
      automaticTransferPair('100', '10', 8, source, target, 'Transfer'),
    ).toThrow();
  });
});
