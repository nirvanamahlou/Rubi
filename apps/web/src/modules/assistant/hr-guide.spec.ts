import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LeaveEvidenceList } from '@/modules/hr/leave-evidence-list';
import { HrExportButton } from '@/modules/hr/hr-controls';
import { selectedHrDataset } from '@/modules/hr/hr-row-selection';
import { HrReportsWorkspace } from '@/modules/hr/hr-reports-workspace';
import type { HrStore } from '@/modules/hr/hr-store';
import { assistantGuideCatalogues } from './assistant-guide-registry';
import { renderHrGuide, resolveHrGuide } from './hr-guide';

describe('HR guide', () => {
  it.each(assistantGuideCatalogues['human-resources'].topics)(
    'routes a representative question for $id',
    ({ id, examples }) => {
      expect(resolveHrGuide(examples[0]!, '/hr')).toMatchObject({
        topic: { id },
      });
    },
  );

  it('continues the previous topic after a navigation', () => {
    const result = resolveHrGuide('بعدش چی؟', '/system', 'time');
    if (!result || !('topic' in result)) throw new Error('Expected HR topic');
    expect(renderHrGuide(result.topic, result.followUp)).toContain('نیمه‌شب');
  });

  it('explains how to open only the attachment controls a recorded leave row actually has', () => {
    const topic = assistantGuideCatalogues['human-resources'].topics.find(
      ({ id }) => id === 'requests',
    )!;
    const answer = renderHrGuide(topic, false);
    expect(topic.href).toBe('/hr?section=requests');
    expect(answer).toContain('«رسیدگی» را بزنید');
    expect(answer).toContain('همه وضعیت‌ها');
    const evidence = (ids: string[]) =>
      renderToStaticMarkup(
        createElement(LeaveEvidenceList, { ids, path: '/fixture' }),
      );
    const attached = evidence(['fixture-id']);
    for (const label of ['مدارک استعلاجی', 'مدرک ۱']) {
      expect(attached).toContain(label);
      expect(answer).toContain(label);
    }
    expect(evidence([])).toBe('');
    expect(answer).toContain(
      'اگر پیوستی ثبت نشده باشد، دکمهٔ دریافت مدرک نمایش داده نمی‌شود',
    );
  });

  it('does not handle an explicitly foreign panel or personal status read', () => {
    expect(resolveHrGuide('چطور قرارداد فروش ثبت کنم؟', '/hr')).toBeUndefined();
    expect(resolveHrGuide('مرخصی من در چه وضعیتی است؟', '/hr')).toBeUndefined();
    expect(resolveHrGuide('حقوق من چقدر است؟', '/hr')).toHaveProperty(
      'clarification',
    );
  });

  it('explains the employee filter and requires a selected row for spreadsheet export', () => {
    const employees = assistantGuideCatalogues['human-resources'].topics.find(
      ({ id }) => id === 'employees',
    )!;
    const text = renderHrGuide(employees, false);
    for (const label of [
      'کارکنان سابق',
      'کد پرسنلی',
      'شرکت / شعبه',
      'واحد',
      'خروجی اکسل',
    ])
      expect(text).toContain(label);
    expect(text).toContain('تا ردیفی انتخاب نشود دکمه غیرفعال است');
    const table = {
      columns: ['کد'],
      rows: [['1']],
      recordIds: ['fixture-id'],
      totalLabel: '',
    };
    const output = (ids: string[]) =>
      renderToStaticMarkup(
        createElement(HrExportButton, {
          data: selectedHrDataset(table, new Set(ids)),
          name: 'fixture',
        }),
      );
    expect(output([])).toContain(' disabled=""');
    expect(output(['fixture-id'])).not.toContain(' disabled=""');
  });

  it('links balance and cardex to the native read-only reporting tab', () => {
    const topic = assistantGuideCatalogues['human-resources'].topics.find(
      ({ id }) => id === 'leave-balance',
    )!;
    const answer = renderHrGuide(topic, false);
    const store = {
      revision: 0,
      data: {
        capabilities: {},
        employees: [],
        records: [],
        branches: [],
        branchIds: [],
      },
    } as unknown as HrStore;
    const screen = renderToStaticMarkup(
      createElement(HrReportsWorkspace, { store, tab: 'leaveBalance' }),
    );
    expect(topic.href).toBe('/hr?section=reports&tab=leaveBalance');
    for (const label of [
      'گزارش مانده مرخصی',
      'کاردکس مانده مرخصی',
      'انتخاب سال',
      'گرفتن گزارش',
    ]) {
      expect(answer).toContain(label);
      expect(screen).toContain(label);
    }
    expect(answer).toContain('یک تا ۱۰۰ نفر');
    expect(answer).toContain('مانده ساعت:دقیقه');
    expect(screen).not.toContain('افزودن مانده مرخصی');
  });
});
