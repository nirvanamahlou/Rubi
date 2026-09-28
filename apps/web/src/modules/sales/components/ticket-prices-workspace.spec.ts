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
    expect(source).toContain('قیمت‌های رفت‌وبرگشت ثبت‌شده');
    expect(source).toContain('filteredPairs.map((pair)');
    expect(source).toContain('تاریخ رفت از');
    expect(source).toContain('تاریخ رفت تا');
    expect(source).toContain('ثبت نسخه جدید');
    expect(source).toContain('editPair(pair)');
    expect(source).toContain('مبنای قراردادهای جدید');
    expect(source).toContain('خلاصه قیمت‌گذاری بلیط‌ها');
    expect(source).toContain('فهرست قیمت‌گذاری');
    expect(source).toContain('bg-gradient-to-br from-sky-500/20');
    expect(source).toContain('مقصد سفر:');
    expect(source).toContain(
      'faDay.format(new Date(pair.outbound.departureAt))',
    );
    expect(source).toContain('تاریخ بلیط');
    expect(source).toContain('faDay.format(new Date(offer.departureAt))');
  });
});
