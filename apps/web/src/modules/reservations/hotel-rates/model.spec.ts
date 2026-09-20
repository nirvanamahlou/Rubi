import { describe, it, expect } from 'vitest';
import { price } from './model';
describe('purchase price preview', () => {
  it('matches half-up currency rounding', () => {
    expect(price('10.05', '1.5', 'EUR')).toBe('15.08');
    expect(price('11', '1.5', 'IRR')).toBe('17');
  });
  it('retains large decimal precision', () =>
    expect(price('999999999999.99', '999.999', 'USD')).toBe(
      '999998999999990.00',
    ));
  it('does not display malformed or partially typed amounts', () => {
    expect(price('1e3', '1', 'EUR')).toBe('—');
    expect(price('', '1', 'EUR')).toBe('—');
  });
});
