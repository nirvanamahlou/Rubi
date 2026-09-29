import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { CustomerAffairsNoraWorkspace } from './customer-affairs-nora-workspace';
import {
  DetailPanel,
  mutateAndRefreshDetail,
  type Detail,
} from './customer-affairs-workspace';

const route = vi.hoisted(() => ({ query: '' }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(route.query),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('Nora Customer Affairs navigation', () => {
  it('distinguishes a committed mutation from a failed detail refresh', async () => {
    await expect(
      mutateAndRefreshDetail(
        vi.fn().mockResolvedValue({ data: { version: 2 } }),
        vi.fn().mockResolvedValue(undefined),
      ),
    ).resolves.toBe(true);
    const operation = vi.fn().mockResolvedValue({ data: { version: 2 } });
    const refresh = vi.fn().mockRejectedValue(new Error('GET failed'));
    await expect(mutateAndRefreshDetail(operation, refresh)).resolves.toBe(
      false,
    );
    expect(operation).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();

    const rejected = vi.fn().mockRejectedValue(new Error('POST failed'));
    const untouchedRefresh = vi.fn();
    await expect(
      mutateAndRefreshDetail(rejected, untouchedRefresh),
    ).rejects.toThrow('POST failed');
    expect(untouchedRefresh).not.toHaveBeenCalled();
  });
  it('places the assessment beside new communication in a request profile', () => {
    const detail = {
      id: 'request',
      trackingNumber: 'CA-L-1',
      title: 'سفر نمایشگاهی',
      travelNeed: 'بازدید نمایشگاه',
      stage: 'NEW',
      priority: 'LOW',
      nextAction: 'تماس با مشتری',
      nextActionAt: '2026-09-29T10:00:00Z',
      customerId: null,
      timeline: [],
    } as unknown as Detail;
    const html = renderToStaticMarkup(
      <DetailPanel
        detail={detail}
        tab="leads"
        onBack={() => {}}
        onReload={async () => {}}
      />,
    );
    expect(html).toContain('CA-L-1');
    expect(html).toContain('نیاز سفر');
    expect(html).toContain('تماس با مشتری');
    expect(html).toContain('تنظیم پیگیری بعدی');
    expect(html).toContain('ثبت مشتری برای درخواست');
    const actionRow =
      html.match(
        /<div class="[^"]*profileActions[^"]*">([\s\S]*?)<\/div>/,
      )?.[1] ?? '';
    expect(actionRow).not.toBe('');
    expect(actionRow).toContain('ثبت مشتری برای درخواست');
    expect(actionRow).not.toContain('ارزیابی آمادگی فروش');
    expect(actionRow).toContain('ارسال به فروش');
    expect(actionRow).toContain('تنظیم پیگیری بعدی');
    expect(html).toContain('سابقه ارتباط و رسیدگی');
    const historyActions =
      html
        .slice(html.indexOf('سابقه ارتباط و رسیدگی'))
        .match(
          /<div class="[^"]*profileSectionActions[^"]*">([\s\S]*?)<\/div>/,
        )?.[1] ?? '';
    expect(historyActions).toContain('ارزیابی آمادگی فروش');
    expect(historyActions).toContain('ثبت ارتباط جدید');
  });
  it('shows the saved assessment report after reload and permits re-evaluation', () => {
    const detail = {
      id: 'request',
      trackingNumber: 'CA-L-2',
      title: 'سفر کاری',
      travelNeed: 'نمایشگاه',
      stage: 'QUALIFIED',
      priority: 'NORMAL',
      version: 2,
      nextAction: 'تحویل به فروش',
      nextActionAt: '2026-09-29T10:00:00Z',
      customerId: 'customer',
      qualification: {
        state: 'QUALIFIED',
        score: 85,
        reasons: ['نیاز سفر تایید شده', 'مقصد مشخص است', 'بودجه بررسی شده'],
        conversionProbability: 65,
        evaluatedAt: '2026-09-29T09:00:00Z',
      },
      timeline: [
        { type: 'STATUS_CHANGE', summary: 'ارزیابی با امتیاز 85 ثبت شد.' },
      ],
    } as unknown as Detail;
    const html = renderToStaticMarkup(
      <DetailPanel
        detail={detail}
        tab="leads"
        onBack={() => {}}
        onReload={async () => {}}
      />,
    );
    const historyActions =
      html
        .slice(html.indexOf('سابقه ارتباط و رسیدگی'))
        .match(
          /<div class="[^"]*profileSectionActions[^"]*">([\s\S]*?)<\/div>/,
        )?.[1] ?? '';
    expect(historyActions).toContain('ارزیابی آمادگی فروش');
    expect(historyActions).not.toMatch(/<button[^>]*\sdisabled(?:=""|>)/);
    expect(html).toContain('آخرین نتیجه ارزیابی آمادگی فروش');
    expect(html).toContain('آماده تحویل به فروش');
    expect(html).toContain('امتیاز آمادگی');
    expect(html).toContain('احتمال تبدیل به فروش');
    expect(html).toContain('نیاز سفر مشخص و تأیید شده است');
    expect(html).toContain('مقصد یا گزینه‌های پذیرفتنی مشخص است');
    expect(html).toContain('درباره بودجه گفتگو شده است');
    expect(html).toContain('زمان سفر یا انعطاف آن مشخص است');
    expect(html).toContain('تأیید نشده');
  });
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
      new URL('./customer-affairs-nora-workspace.tsx', import.meta.url),
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
    expect(source).toContain('<AffairsReportPanel');
  });
  it('renders the four reference sections inside the existing application shell', () => {
    route.query = '';
    const html = renderToStaticMarkup(<CustomerAffairsNoraWorkspace />);
    for (const label of [
      'نمای کلی',
      'درخواست‌های مشتریان',
      'تیکت‌های پشتیبانی',
      'گزارش‌ها',
    ])
      expect(html).toContain(label);
    expect(html).not.toContain('تنظیمات');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('در حال دریافت اطلاعات');
    expect(html).not.toContain('<aside');
    expect(html).not.toContain('سرنخ');
    expect(html).not.toContain('درخواست‌های باز'); // No fabricated counts before the API resolves.
  });

  it('suppresses the supplementary HR requests outlet on Customer Affairs', () => {
    const source = readFileSync(
      new URL('./customer-affairs-nora-workspace.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('useSuppressHrConnections(true)');
  });

  it('handles partial permissions and expired sessions explicitly', () => {
    const source = readFileSync(
      new URL('./customer-affairs-nora-workspace.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('e.status === 401');
    expect(source).toContain("'unauthorized'");
    expect(source).toContain('/login?next=%2Fcustomer-affairs');
    expect(source).toContain('capabilities.leadsRead');
    expect(source).toContain('capabilities.ticketsRead');
    expect(source).toContain('access?.leadCreate');
    expect(source).toContain('access?.ticketCreate');
    expect(source).toContain('با موفقیت ثبت شد');
  });

  it('retains the legacy ticket URL and support subnavigation', () => {
    route.query = 'tab=tickets';
    const html = renderToStaticMarkup(<CustomerAffairsNoraWorkspace />);
    expect(html).toContain('تیکت‌های معوق');
    expect(html).not.toContain('رضایت و اقدام اصلاحی');
    expect(html).not.toContain('منتظر پذیرش فروش');
  });

  it('offers the presales views without duplicating support subnavigation', () => {
    route.query = 'view=handoffs';
    const html = renderToStaticMarkup(<CustomerAffairsNoraWorkspace />);
    expect(html).toContain('منتظر پذیرش فروش');
    expect(html).toContain('پیگیری معوق');
    expect(html).not.toContain('رضایت و اقدام اصلاحی');
  });

  it('aligns list view controls and Excel export in the same toolbar', () => {
    const source = readFileSync(
      new URL('./customer-affairs-nora-workspace.tsx', import.meta.url),
      'utf8',
    );
    const styles = readFileSync(
      new URL('./customer-affairs-nora.module.css', import.meta.url),
      'utf8',
    );
    expect(source).toContain('className={`${s.actions} ${s.listToolbar}`}');
    expect(styles).toMatch(
      /\.listToolbar \.subtabs\s*\{[^}]*margin-bottom:\s*0;/,
    );
    expect(styles).toMatch(
      /\.listToolbar \.subtabs button\s*\{[^}]*min-height:\s*40px;/,
    );
  });

  it('contains report date filters in a full-width card', () => {
    const source = readFileSync(
      new URL('./customer-affairs-nora-workspace.tsx', import.meta.url),
      'utf8',
    );
    const styles = readFileSync(
      new URL('./customer-affairs-nora.module.css', import.meta.url),
      'utf8',
    );
    expect(source).toMatch(
      /<section\s+className=\{s\.reportFilters\}[\s\S]*?<CreatedDateFilter/,
    );
    expect(styles).toMatch(/\.reportFilters\s*\{[^}]*width:\s*100%;/);
    expect(styles).toMatch(
      /\.reportFilters\s*\{[^}]*border:\s*1px solid var\(--border\);/,
    );
  });
});
