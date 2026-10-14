import { describe, expect, it } from 'vitest';
import {
  distributeClosing,
  selectClosingLots,
  validateHistoricalCarry,
} from './accounting.year-end';

describe('I01 closing selection and exact distribution', () => {
  it('conserves positive and negative amounts with stable largest remainders', () => {
    expect(distributeClosing('1001', ['60', '40'], 0)).toEqual(['601', '400']);
    expect(distributeClosing('-1001', ['60', '40'], 0)).toEqual([
      '-601',
      '-400',
    ]);
    expect(distributeClosing('0.01', ['50', '50'], 2)).toEqual(['0.01', '0']);
    expect(distributeClosing('999999999999999999', ['60', '40'], 0)).toEqual([
      '599999999999999999',
      '400000000000000000',
    ]);
  });
  it('rejects invalid percentages and subminor-unit balances', () => {
    for (const p of [
      ['0', '100'],
      ['-1', '101'],
      ['60', '39'],
    ])
      expect(() => distributeClosing('1001', p, 0)).toThrow();
    expect(() => distributeClosing('1.1', ['100'], 0)).toThrow();
  });
  it('excludes before detecting overlap and respects detail wildcard and side', () => {
    const lot = {
      accountId: 'a',
      detail4Id: 'd',
      detail5Id: null,
      detail6Id: null,
      balance: '10',
      permanent: false,
    };
    const include = { ...lot, include: true, side: 'DEBIT' };
    expect(selectClosingLots([lot], [{ ...include, detail4Id: null }])).toEqual(
      [lot],
    );
    expect(() =>
      selectClosingLots([lot], [include, { ...include, detail4Id: null }]),
    ).toThrow();
    expect(
      selectClosingLots(
        [lot],
        [include, include, { ...include, include: false }],
      ),
    ).toEqual([]);
    expect(selectClosingLots([{ ...lot, balance: '-10' }], [include])).toEqual(
      [],
    );
    expect(selectClosingLots([{ ...lot, permanent: true }], [])).toEqual([]);
  });
});

describe('historical foreign rounding residuals', () => {
  it('rejects opposite signs and zero-base foreign residuals without flipping quantities', () => {
    // At rate 1 in IRR, rounded .60 + .60 - 1.49 leaves base +1 and foreign -.29.
    expect(() => validateHistoricalCarry('1', '-0.29')).toThrow('جهت');
    expect(() => validateHistoricalCarry('-1', '0.29')).toThrow('جهت');
    expect(() => validateHistoricalCarry('0', '-0.29')).toThrow('صفر');
    expect(() => validateHistoricalCarry('-1', '-0.29')).not.toThrow();
    expect(() => validateHistoricalCarry('1', '0.29')).not.toThrow();
    expect(() => validateHistoricalCarry('1', null)).not.toThrow();
  });
});
