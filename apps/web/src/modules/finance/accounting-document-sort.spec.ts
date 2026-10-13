import { describe, expect, it } from 'vitest';
import { compareDocumentText } from './accounting-document-sort';
describe('exact document grid sorting', () => {
  it('distinguishes adjacent large amounts and extremely small fractional differences', () => {
    expect(
      compareDocumentText('9007199254740993.99', '9007199254740993.98', true),
    ).toBe(1);
    expect(compareDocumentText('0.1000000000000000001', '0.2', true)).toBe(-1);
    expect(compareDocumentText('001.20', '+1.2', true)).toBe(0);
  });
  it('handles negative auxiliary numbers and sorts ordinary references naturally', () => {
    expect(compareDocumentText('-12', '-2', true)).toBe(-1);
    expect(compareDocumentText('QA-2', 'QA-10', true)).toBeLessThan(0);
  });
});
