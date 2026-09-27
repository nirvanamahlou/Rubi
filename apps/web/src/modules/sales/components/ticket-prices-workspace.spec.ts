import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ticket prices workspace', () => {
  it('owns one-way and round-trip ticket sale price actions under Sales', () => {
    const source = readFileSync(
      new URL('./ticket-prices-workspace.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('title="قیمت بلیط"');
    expect(source).toContain('updateStandaloneSalePrice(');
    expect(source).toContain('updateRoundTripSalePrice(');
    expect(source).toContain('قیمت کل رفت‌وبرگشت');
    expect(source).toContain('مبنای قراردادهای جدید');
    expect(source).toContain('خلاصه قیمت‌گذاری بلیط‌ها');
    expect(source).toContain('فهرست قیمت‌گذاری');
    expect(source).toContain('bg-gradient-to-br from-sky-500/20');
  });
});
