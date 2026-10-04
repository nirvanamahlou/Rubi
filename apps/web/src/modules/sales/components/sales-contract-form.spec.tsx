import type * as React from 'react';
import { emptySalesForm } from '../model/sales-form';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SalesContractForm } from './sales-contract-form';

const fixture = vi.hoisted(() => ({ flight: false, step: 0 }));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    let value =
      typeof initial === 'function' ? (initial as () => unknown)() : initial;
    if (
      value &&
      typeof value === 'object' &&
      'serviceKinds' in value &&
      fixture.flight
    )
      value = { ...emptySalesForm, serviceKinds: ['FLIGHT'] };
    return [value, vi.fn()];
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe('compact sales contract form', () => {
  it('puts the required flight range after route and passenger counts in the first step', () => {
    fixture.flight = true;
    const html = renderToStaticMarkup(<SalesContractForm />);
    fixture.flight = false;
    expect(html).toContain('بازه تاریخ سفر (الزامی)');
    expect(html).toContain('انتخاب شروع سفر');
    expect(html).toContain('انتخاب پایان سفر');
    expect(html.indexOf('تعداد مسافران')).toBeLessThan(
      html.indexOf('بازه تاریخ سفر (الزامی)'),
    );
    expect(html.match(/aria-label="بازه تاریخ سفر"/g)).toHaveLength(1);
    expect(html).not.toContain('بلیط رفت');
  });
  it('shows a bounded form and compact services without asking for a route date', () => {
    const html = renderToStaticMarkup(<SalesContractForm />);
    expect(html).toContain('max-w-6xl');
    expect(html).toContain('min-w-0');
    expect(html).toContain('grid-cols-[minmax(0,1fr)]');
    expect(html).toContain('داشبورد قراردادها');
    expect(html).toContain('مراحل ثبت قرارداد');
    expect(html).toContain('مسیر سفر');
    expect(html).toContain('تعداد مسافران');
    expect(html).toContain('بزرگسال');
    expect(html).toContain('کودک');
    expect(html).toContain('نوزاد');
    expect(html.match(/type="number"/g)).toHaveLength(3);
    for (const label of ['بزرگسال', 'کودک', 'نوزاد']) {
      expect(html).toContain(`aria-label="تعداد ${label}"`);
    }
    expect(html).toContain('نوزاد لازم نیست در تعداد صندلی بلیط شمرده شود');
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
