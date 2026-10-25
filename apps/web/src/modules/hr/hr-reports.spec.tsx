import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HrReports } from './hr-reports';
import { radanReports } from './radan-reports';
import {
  coefficientPaths,
  normalizeCoefficientSelection,
  radanReportForm,
  radanDefaultReportRange,
} from './radan-report-fields';
import type { HrStore } from './hr-store';
const store = {
  revision: 0,
  data: {
    employees: [],
    records: [],
    branches: [],
    branchIds: [],
    capabilities: { audit: false },
  },
} as unknown as HrStore;
describe('authenticated Radan report field parity', () => {
  it('keeps all21 report forms and all52 observed coefficient nodes', () => {
    expect(radanReports).toHaveLength(21);
    expect(coefficientPaths()).toHaveLength(52);
    expect(new Set(coefficientPaths()).size).toBe(52);
    expect(radanReportForm('total').units).toEqual([
      'default',
      'clock',
      'days',
    ]);
    expect(radanReportForm('people').sortOptions).toEqual([
      'name',
      'code',
      'identification',
    ]);
    expect(radanReportForm('total').sortOptions).toEqual(['name', 'code']);
    expect(radanReportForm('daily').sortOptions).toEqual([
      'name',
      'lastName',
      'code',
    ]);
  });
  it('renders multiple contracts, coefficients and chart-based personnel without unrelated unit filters', () => {
    const html = renderToStaticMarkup(
      <HrReports store={store} initialTopic="radan:general" />,
    );
    for (const label of [
      'نوع قرارداد',
      'ضرایب',
      'خدماتی-مشاوره‌ای',
      'کاربران',
      'افزودن',
      'اضافه کار غیر مجاز',
      'نوبت کاری 22.5 درصد',
    ])
      expect(html).toContain(label);
    expect(html).not.toContain('>نوع گزارش<');
    const daily = renderToStaticMarkup(
      <HrReports store={store} initialTopic="radan:daily" />,
    );
    expect(daily).not.toContain('>نوع قرارداد<');
    expect(daily).not.toContain('>ضرایب<');
    expect(daily).not.toContain('>نوع گزارش<');
  });
  it('keeps presence to one date and limits aggregate controls to their six observed forms', () => {
    const html = renderToStaticMarkup(
      <HrReports store={store} initialTopic="radan:presence" />,
    );
    expect(html).not.toContain('از تاریخ');
    expect(html).not.toContain('تا تاریخ');
    const people = renderToStaticMarkup(
      <HrReports store={store} initialTopic="radan:people" />,
    );
    expect(people).toContain('کد شناسایی');
    expect(people).toContain('ستون‌های افراد');
    for (const [id] of radanReports)
      expect(radanReportForm(id).aggregate).toBe(
        ['late', 'early', 'absence', 'mission', 'leave', 'overtime'].includes(
          id,
        ),
      );
    for (const id of [
      'remote',
      'dailyMinutes',
      'totalMinutes',
      'present',
      'forgiveness',
      'arpa',
    ]) {
      expect(radanReportForm(id).requiredGroups).toBe(true);
      expect(radanReportForm(id).sortOptions).toHaveLength(0);
    }
  });
});

it('keeps parent coefficient selection consistent after a child is cleared', () => {
  const all = coefficientPaths();
  const selected = normalizeCoefficientSelection(
    all.filter((path) => path !== 'مرخصی / ساعتی / استحقاقی'),
  );
  expect(selected).not.toContain('مرخصی');
  expect(selected).not.toContain('مرخصی / ساعتی');
  expect(selected).toContain('مرخصی / روزانه');
  expect(normalizeCoefficientSelection(all)).toHaveLength(52);
});

it('prefills only the general report with the current Tehran Jalali month', () => {
  expect(
    radanDefaultReportRange('general', new Date('2026-10-25T08:00:00.000Z')),
  ).toEqual({ from: '2026-10-23', to: '2026-10-25' });
  expect(radanDefaultReportRange('daily')).toEqual({ from: '', to: '' });
});
