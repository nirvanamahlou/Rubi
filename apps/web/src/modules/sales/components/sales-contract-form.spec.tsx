import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SalesContractForm } from './sales-contract-form';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe('compact sales contract form', () => {
  it('shows a bounded form and compact services without asking for a route date', () => {
    const html = renderToStaticMarkup(<SalesContractForm />);
    expect(html).toContain('max-w-6xl');
    expect(html).toContain('داشبورد قراردادها');
    expect(html).toContain('مراحل ثبت قرارداد');
    expect(html).toContain('مسیر سفر');
    expect(html).toContain('aria-label="مبدأ سفر"');
    expect(html).toContain('aria-label="مقصد سفر"');
    expect(html).toMatch(
      /aria-label="مبدأ سفر"[\s\S]*کشور مبدأ[\s\S]*شهر مبدأ[\s\S]*aria-label="مقصد سفر"[\s\S]*کشور مقصد[\s\S]*شهر مقصد/,
    );
    expect(html).not.toContain('تاریخ رفت');
    expect(html).not.toContain('min-h-[420px]');
    expect(html.indexOf('کشور مبدأ')).toBeLessThan(html.indexOf('شهر مبدأ'));
    expect(html.indexOf('شهر مبدأ')).toBeLessThan(html.indexOf('کشور مقصد'));
  });
});
