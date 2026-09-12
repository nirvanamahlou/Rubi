import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { CustomerAffairsRubiWorkspace } from './customer-affairs-rubi-workspace';
import { DetailPanel, type Detail } from './customer-affairs-workspace';

const route = vi.hoisted(() => ({ query: '' }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(route.query),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('Rubi Customer Affairs navigation', () => {
  it.each(['NEW', 'RESOLVED', 'CLOSED'] as const)(
    'only offers ticket actions appropriate to %s',
    (status) => {
      const detail = {
        id: 'ticket',
        trackingNumber: 'CA-1',
        subject: 'پیگیری خدمت',
        description: 'توضیح',
        status,
        priority: 'NORMAL',
        nextAction: 'پیگیری',
        nextActionAt: '2026-09-12T12:00:00Z',
        version: 1,
        customerId: null,
        timeline: [],
      } as unknown as Detail;
      const html = renderToStaticMarkup(
        <DetailPanel
          detail={detail}
          tab="tickets"
          onBack={() => {}}
          onReload={async () => {}}
        />,
      );
      expect(html).toContain('ثبت ارتباط جدید');
      expect(html).not.toContain('<form');
      if (status === 'NEW') {
        expect(html).toContain('بررسی اولیه');
        expect(html).not.toContain('بستن پرونده');
        expect(html).not.toContain('دعوت رضایت‌سنجی');
      } else {
        expect(html).not.toContain('بررسی اولیه');
        expect(html).toContain('دعوت رضایت‌سنجی');
        expect(html).toContain('بازگشایی پرونده');
        expect(html.includes('بستن پرونده')).toBe(status === 'RESOLVED');
      }
    },
  );
  it('removes the overview introduction while retaining metrics and report hero', () => {
    const source = readFileSync(
      new URL('./customer-affairs-rubi-workspace.tsx', import.meta.url),
      'utf8',
    );
    expect(source).not.toContain('از اولین تماس تا حل مسئله');
    expect(source).not.toContain(
      'نمای یکپارچه درخواست‌ها، ارتباطات و پشتیبانی مشتریان',
    );
    expect(source).not.toContain(
      'همراه مشتری، از اولین درخواست تا آخرین پیگیری',
    );
    expect(source).toContain('className={s.metrics}');
    expect(source).not.toContain('className={s.hub}');
    expect(source).toContain('className={s.attention}');
    expect(source).toContain('className={s.hero}');
  });
  it('renders the four reference sections inside the existing application shell', () => {
    route.query = '';
    const html = renderToStaticMarkup(<CustomerAffairsRubiWorkspace />);
    for (const label of [
      'نمای کلی',
      'درخواست‌ها و سرنخ‌ها',
      'تیکت‌های پشتیبانی',
      'گزارش‌ها',
    ])
      expect(html).toContain(label);
    expect(html).not.toContain('تنظیمات');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('در حال دریافت اطلاعات');
    expect(html).not.toContain('<aside');
    expect(html).not.toContain('سرنخ‌های باز'); // No fabricated counts before the API resolves.
  });

  it('suppresses the supplementary HR requests outlet on Customer Affairs', () => {
    const source = readFileSync(
      new URL('./customer-affairs-rubi-workspace.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('useSuppressHrConnections(true)');
  });

  it('retains the legacy ticket URL and support subnavigation', () => {
    route.query = 'tab=tickets';
    const html = renderToStaticMarkup(<CustomerAffairsRubiWorkspace />);
    expect(html).toContain('تیکت‌های معوق');
    expect(html).not.toContain('رضایت و اقدام اصلاحی');
    expect(html).not.toContain('منتظر پذیرش فروش');
  });

  it('offers the presales views without duplicating support subnavigation', () => {
    route.query = 'view=handoffs';
    const html = renderToStaticMarkup(<CustomerAffairsRubiWorkspace />);
    expect(html).toContain('منتظر پذیرش فروش');
    expect(html).toContain('پیگیری معوق');
    expect(html).not.toContain('رضایت و اقدام اصلاحی');
  });
});
