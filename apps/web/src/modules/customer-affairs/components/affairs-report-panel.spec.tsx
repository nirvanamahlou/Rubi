import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AffairsReportPanel } from './affairs-report-panel';
import type { AffairsReport } from '../api/customer-affairs-client';

const report: AffairsReport = {
  generatedAt: '2026-09-13T00:00:00Z',
  leadStages: [
    { stage: 'NEW', _count: { _all: 3 } },
    { stage: 'QUALIFIED', _count: { _all: 1 } },
  ],
  ticketStatuses: [{ status: 'CLOSED', _count: { _all: 2 } }],
  satisfaction: { average: 3.5, count: 20 },
  correctiveActions: [
    { status: 'OPEN', _count: { _all: 2 } },
    { status: 'DONE', _count: { _all: 4 } },
  ],
};
const render = (value = report, showRequests = true) =>
  renderToStaticMarkup(
    <AffairsReportPanel
      report={value}
      showRequests={showRequests}
      onRequests={() => {}}
      onTickets={() => {}}
    />,
  );
describe('Customer Affairs report layout', () => {
  it('omits the report introduction while retaining data and timestamp', () => {
    const html = render();
    expect(html).not.toContain('گزارش امور مشتریان');
    expect(html).not.toContain('نمای وضعیت درخواست‌ها، رسیدگی و بازخورد مشتریان');
    expect(html).toContain('آخرین دریافت:');
    expect(html).toContain('وضعیت تیکت‌های پشتیبانی');
  });
  it('shows real totals, part-of-total bars, counts and localized corrective statuses', () => {
    const html = render();
    expect(html).toContain('width:75%');
    expect(html).toContain('width:25%');
    expect(html).toContain('۳٫۵');
    expect(html).toContain('تکمیل‌شده');
    expect(html).toContain('اقدام اصلاحی در جریان');
    expect(html).toContain('همه تاریخ‌ها');
    expect(html).not.toContain('DONE');
  });
  it('does not invent an average or percentage with no data', () => {
    const html = render({
      ...report,
      leadStages: [],
      ticketStatuses: [],
      correctiveActions: [],
      satisfaction: { average: null, count: 0 },
    });
    expect(html).toContain('پس از دریافت اولین پاسخ');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
    expect(html).toContain('هنوز پرونده‌ای ثبت نشده');
  });
  it('keeps the legacy satisfaction view without request distribution', () => {
    expect(render(report, false)).not.toContain('وضعیت درخواست‌های مشتریان');
  });
});
