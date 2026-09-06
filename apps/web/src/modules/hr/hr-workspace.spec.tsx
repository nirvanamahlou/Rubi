import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  HrDashboard,
  HrPreviewForm,
  HrState,
  HrWorkspace,
} from './hr-workspace';
import {
  applyPreview,
  previewRecords,
  queryRecords,
  sections,
  uiStates,
  validatePreview,
} from './hr.model';

describe('HR foundation UI', () => {
  it('offers all sixteen sections and labels every sample', () => {
    expect(sections).toHaveLength(16);
    expect(
      previewRecords.every(
        (row) => row.id.startsWith('preview-') && row.title.includes('نمایشی'),
      ),
    ).toBe(true);
    const html = renderToStaticMarkup(<HrWorkspace />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('grid-cols-2');
    for (const section of sections)
      expect(html).toContain(`/hr?section=${section.id}`);
  });
  it('never claims real KPI values or produces export files', () => {
    const html = renderToStaticMarkup(<HrDashboard />);
    expect(html.match(/داده متصل موجود نیست/g) ?? []).toHaveLength(12);
    const reports = renderToStaticMarkup(<HrWorkspace sectionId="reports" />);
    expect(reports).toContain('disabled');
    expect(reports).toContain('فایل قابل دریافت وجود ندارد');
  });
  it.each(Object.keys(uiStates) as (keyof typeof uiStates)[])(
    'renders %s without private values',
    (state) => {
      const html = renderToStaticMarkup(<HrState state={state} />);
      expect(html).toContain(uiStates[state]);
      expect(html).not.toContain('undefined');
    },
  );
  it('filters before pagination and clamps stale pages', () => {
    const query = {
      section: 'employees',
      search: '',
      status: '',
      direction: 'asc' as const,
      page: 1,
    };
    expect(queryRecords(previewRecords, query).items).toHaveLength(5);
    expect(
      queryRecords(previewRecords, { ...query, page: 2 }).items,
    ).toHaveLength(2);
    expect(
      queryRecords(previewRecords, { ...query, status: 'ACTIVE', page: 99 })
        .page,
    ).toBe(1);
    expect(
      queryRecords(previewRecords, { ...query, search: 'nomatch' }).total,
    ).toBe(0);
  });
  it('keeps create/edit changes explicitly ephemeral and detects stale updates', () => {
    const row = previewRecords[0]!;
    const result = applyPreview(
      previewRecords,
      { ...row, title: 'نمونه اصلاح‌شده' },
      1,
    );
    expect(result[0]?.version).toBe(2);
    expect(previewRecords[0]?.version).toBe(1);
    expect(() => applyPreview(result, row, 1)).toThrow('CONFLICT');
  });
  it('validates required fields, dates and decimal input', () => {
    const section = sections.find((item) => item.id === 'compensation')!;
    expect(validatePreview(section, {})).toContain('الزامی');
    const values = {
      title: 'نمایشی',
      employee: 'کارمند نمایشی الف',
      kind: 'مزایا',
      amount: '1e10',
      currency: 'IRR',
    };
    expect(validatePreview(section, values)).toContain('اعشاری');
    expect(
      validatePreview(section, { ...values, amount: '100.00' }),
    ).toBeNull();
  });
  it.each(['create', 'view', 'edit'] as const)(
    'renders %s form with sensitive controls disabled',
    (mode) => {
      const section = sections.find((item) => item.id === 'employees')!;
      const html = renderToStaticMarkup(
        <HrPreviewForm
          section={section}
          mode={mode}
          onSubmit={() => undefined}
        />,
      );
      expect(html).toContain('کد ملی');
      expect(html).toContain('••••••••');
      expect(html).toContain('disabled');
      expect(html).not.toMatch(/type="date"|type="datetime-local"/);
    },
  );
});
