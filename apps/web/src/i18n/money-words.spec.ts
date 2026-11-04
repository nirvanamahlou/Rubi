import { describe, expect, it } from 'vitest';
import { moneyInWords } from './money-words';

describe('exact money spelling', () => {
  it.each([
    ['0', 'صفر ریال'],
    ['25000', 'بیست و پنج هزار ریال'],
    ['1000000000', 'یک میلیارد ریال'],
    ['۲۵٬۰۰۰', 'بیست و پنج هزار ریال'],
    ['٠٠٢٥٫٥٠', 'بیست و پنج ممیز پنج دهم ریال'],
    ['1.0001', 'یک ممیز یک ده‌هزارم ریال'],
    ['.5', 'صفر ممیز پنج دهم ریال'],
    ['1000.', 'هزار ریال'],
  ])('spells %s without changing its unit', (amount, words) => {
    expect(moneyInWords(amount, 'IRR')).toBe(words);
  });
  it('preserves values beyond floating point precision', () => {
    expect(moneyInWords('9007199254740993', 'IRR', 'en')).toBe(
      'nine quadrillion seven trillion one hundred ninety-nine billion two hundred fifty-four million seven hundred forty thousand nine hundred ninety-three Iranian rials',
    );
  });
  it('uses the selected currency and locale', () => {
    expect(moneyInWords('25.1250', 'USD')).toBe(
      'بیست و پنج ممیز صد و بیست و پنج هزارم دلار آمریکا',
    );
    expect(moneyInWords('25.1250', 'EUR', 'en')).toBe(
      'twenty-five point one two five Euro',
    );
  });
  it.each(['', '.', '-1', 'NaN', '1.00001', '1000000000000000000', '1e5'])(
    'omits incomplete or invalid amounts %s',
    (amount) => {
      expect(moneyInWords(amount, 'IRR')).toBe('');
    },
  );
});
