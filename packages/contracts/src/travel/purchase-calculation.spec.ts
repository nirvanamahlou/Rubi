import { describe, expect, it } from 'vitest';
import { reservationServicePurchaseTotal } from './index';

describe('service purchase calculation', () => {
  it('multiplies base, fractional factor and contract nights exactly', () => {
    expect(reservationServicePurchaseTotal('125.5', '1.5', 4)).toBe('753');
    expect(reservationServicePurchaseTotal('0.0001', '0.5', 3)).toBe('0.0002');
    expect(reservationServicePurchaseTotal('9007199254740993', '1', 2)).toBe(
      '18014398509481986',
    );
  });
  it.each(['0', '-1', 'NaN', '1.00001', '1e3'])(
    'rejects invalid factor %s',
    (factor) => {
      expect(() => reservationServicePurchaseTotal('100', factor, 3)).toThrow();
    },
  );
  it.each([0, -1, 1.5, NaN])('rejects invalid nights %s', (nights) => {
    expect(() => reservationServicePurchaseTotal('100', '1', nights)).toThrow();
  });
});
