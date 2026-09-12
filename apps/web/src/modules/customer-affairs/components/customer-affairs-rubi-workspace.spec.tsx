import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { CustomerAffairsRubiWorkspace } from './customer-affairs-rubi-workspace';

const route = vi.hoisted(() => ({ query: '' }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(route.query),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('Rubi Customer Affairs navigation', () => {
  it('removes the overview introduction while retaining metrics and report hero', () => {
    const source = readFileSync(
      new URL('./customer-affairs-rubi-workspace.tsx', import.meta.url),
      'utf8',
    );
    expect(source).not.toContain('از اولین تماس تا حل مسئله');
    expect(source).not.toContain(
      'نمای یکپارچه درخواست‌ها، ارتباطات و پشتیبانی مشتریان',
    );
    expect(source).toContain('className={s.metrics}');
    expect(source).toContain('className={s.hub}');
    expect(source).toContain('className={s.hero}');
  });
  it('renders the five reference sections inside the existing application shell', () => {
    route.query = '';
    const html = renderToStaticMarkup(<CustomerAffairsRubiWorkspace />);
    for (const label of [
      'نمای کلی',
      'پیش از فروش',
      'پشتیبانی',
      'گزارش‌ها',
      'تنظیمات',
    ])
      expect(html).toContain(label);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('در حال دریافت اطلاعات');
    expect(html).not.toContain('<aside');
    expect(html).not.toContain('سرنخ‌های باز'); // No fabricated counts before the API resolves.
  });

  it('retains the legacy ticket URL and support subnavigation', () => {
    route.query = 'tab=tickets';
    const html = renderToStaticMarkup(<CustomerAffairsRubiWorkspace />);
    expect(html).toContain('صف‌ها و مهلت رسیدگی');
    expect(html).toContain('رضایت و اقدام اصلاحی');
    expect(html).not.toContain('درخواست‌ها و سرنخ‌ها');
  });

  it('offers the presales views without duplicating support subnavigation', () => {
    route.query = 'view=handoffs';
    const html = renderToStaticMarkup(<CustomerAffairsRubiWorkspace />);
    expect(html).toContain('تحویل‌های فروش');
    expect(html).toContain('پیگیری‌ها و ارتباطات');
    expect(html).not.toContain('رضایت و اقدام اصلاحی');
  });
});
