import { describe, expect, it } from 'vitest';
import { nativeCalculationFeatures } from './calculation-lineage';

describe('audited dashboard calculation lineage', () => {
  it('uses price components and refunds for net sales, not collections or service-line revenue', () => {
    expect(nativeCalculationFeatures('net-sales')?.map((x) => x.label)).toEqual(
      ['قراردادهای فروش', 'اجزای مبلغ قرارداد', 'بازپرداخت‌های انجام‌شده'],
    );
    expect(
      nativeCalculationFeatures('collected')?.map((x) => x.label),
    ).toContain('پرداخت‌های تأییدشده مالی');
  });
  it('adds service kind only for service breakdown charts', () => {
    expect(
      nativeCalculationFeatures('service-type')?.map((x) => x.label),
    ).toContain('نوع خدمات قرارداد');
    expect(
      nativeCalculationFeatures('sales-weekday-pattern')?.map((x) => x.label),
    ).not.toContain('نوع خدمات قرارداد');
  });
  it('does not present required accounting or unsupported employee sources as connected', () => {
    for (const id of [
      'account-balance',
      'gross-profit',
      'net-profit',
      'expense-trend',
    ])
      expect(nativeCalculationFeatures(id)).toBeNull();
  });
  it('traces lead growth through paid conversion and both period cohorts', () => {
    expect(
      nativeCalculationFeatures('lead-growth-rate')?.map((x) => x.label),
    ).toContain('سابقه خرید پرداخت‌شده مشتری');
    expect(
      nativeCalculationFeatures('customer-growth-overview')?.map(
        (x) => x.label,
      ),
    ).toContain('درخواست‌های اولیه و ارجاع به فروش');
  });
});

it('traces activated domain measures without declaring accounting profit connected', () => {
  for (const id of [
    'employee-sales-amount',
    'employee-call-count',
    'remaining-capacity',
    'hotel-reservations',
    'employee-workdays',
    'document-quality-overview',
  ])
    expect(nativeCalculationFeatures(id)?.length, id).toBeGreaterThan(0);
  expect(nativeCalculationFeatures('net-profit')).toBeNull();
});
