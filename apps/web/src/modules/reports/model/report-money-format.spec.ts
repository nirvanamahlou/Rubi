import { describe, it, expect } from 'vitest';
import { formatReportMoney, isReportMoneyColumn } from './report-money-format';
describe('report monetary display', () => {
  it.each([
    [
      '8002456732 ریال + 254367 $ + 132587 €',
      '8,002,456,732 ریال + 254,367 $ + 132,587 €',
    ],
    ['-9007199254740993.123400', '-9,007,199,254,740,993.123400'],
    ['8,002,456,732 ریال', '8,002,456,732 ریال'],
    ['0', '0'],
    ['0.00100', '0.00100'],
    ['—', '—'],
  ])('formats %s exactly', (input, output) =>
    expect(formatReportMoney(input)).toBe(output),
  );
  it('distinguishes amounts from identifiers and counts', () => {
    expect(isReportMoneyColumn({ key: 'salesAmount', kind: 'TEXT' })).toBe(
      true,
    );
    expect(isReportMoneyColumn({ key: 'rate', kind: 'MONEY' })).toBe(true);
    expect(isReportMoneyColumn({ key: 'orderCount', kind: 'NUMBER' })).toBe(
      false,
    );
    expect(isReportMoneyColumn({ key: 'primaryDimension', kind: 'TEXT' })).toBe(
      false,
    );
  });
});
