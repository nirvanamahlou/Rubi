import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HrState, HrWorkspace } from './hr-workspace';
import {
  employeeTabs,
  hrHubCards,
  iranLocalizationStatus,
  normalizeSection,
  sectionTabs,
} from './hr.model';

describe('HR reference implementation', () => {
  it('renders the eighteen capability hub cards as deep links', () => {
    const html = renderToStaticMarkup(<HrWorkspace sectionId="home" />);
    expect(hrHubCards).toHaveLength(18);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('data-hr-mode="preview"');
    for (const card of hrHubCards) {
      expect(html).toContain(card.title);
      expect(html).toContain(`/hr?section=${card.id}`);
    }
  });

  it('fills the overview with explicit preview metrics and working filters', () => {
    const html = renderToStaticMarkup(<HrWorkspace sectionId="dashboard" />);
    for (const value of [
      '۸۶',
      '۷۳',
      '۹',
      '۱۴',
      '۷',
      '۲۳',
      '۲۸۶ ساعت',
      '۹۴٪',
    ]) {
      expect(html).toContain(value);
    }
    expect(html).toContain('امروز — ۱۴ شهریور ۱۴۰۵');
    expect(html).toContain('همه شعب');
    expect(html).toContain('همه واحدها');
    expect(html).toContain('اعمال فیلتر');
    expect(html).toContain('داده آزمایشی');
    expect(html).not.toContain('داده متصل موجود نیست');
    expect(html).not.toContain('منبع عملیاتی متصل نیست');
    expect(html).not.toContain('خروجی داشبورد');
    expect(html).not.toContain('ورود کارمند');
  });

  it('provides the complete employee profile and section tab sets', () => {
    expect(employeeTabs).toHaveLength(15);
    expect(sectionTabs.organization).toHaveLength(6);
    expect(sectionTabs.recruitment).toHaveLength(8);
    expect(sectionTabs.lifecycle).toHaveLength(7);
    expect(sectionTabs.contracts).toHaveLength(5);
    expect(sectionTabs.time).toHaveLength(13);
    expect(sectionTabs.development).toHaveLength(8);
    expect(sectionTabs.expenses).toHaveLength(4);
    expect(sectionTabs.benefits).toHaveLength(6);
    expect(sectionTabs.fleet).toHaveLength(2);
    expect(sectionTabs.requests).toHaveLength(9);
    expect(sectionTabs.finance).toHaveLength(4);
    expect(sectionTabs.reports).toHaveLength(3);
    expect(sectionTabs.payroll).toHaveLength(10);
    expect(sectionTabs.hrSettings).toHaveLength(6);
    const html = renderToStaticMarkup(<HrWorkspace sectionId="employee" />);
    for (const tab of employeeTabs) expect(html).toContain(tab.label);
    expect(html).toContain('••••••••');
  });

  it('uses explicit preview identifiers and no reference personal data', () => {
    const employees = renderToStaticMarkup(
      <HrWorkspace sectionId="employees" />,
    );
    expect(employees).toContain('preview-employee-1');
    expect(employees).toContain('همکار نمایشی الف');
    expect(employees.match(/همکار نمایشی/g)?.length ?? 0).toBe(4);
    expect(employees).not.toMatch(/EMP-\d|EMPLOY-\d/);
  });

  it('keeps payroll and exports in a truthful preview state', () => {
    const html = renderToStaticMarkup(<HrWorkspace sectionId="payroll" />);
    expect(html).toContain('اجرای حقوق غیرفعال است');
    expect(html).toContain('preview-payrun-v1');
    expect(html).toContain('محاسبه قانونی');
    expect(html.match(/disabled/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(html).not.toContain('میلیارد');
  });

  it.each([
    ['recruitment', 'جذب و استخدام', 'preview-recruitment-1'],
    ['lifecycle', 'چرخه همکاری', 'preview-lifecycle-1'],
    ['expenses', 'مأموریت و هزینه‌ها', 'preview-expenses-1'],
    ['benefits', 'مالیات و مزایا', 'preview-benefits-1'],
    ['fleet', 'خودروهای سازمانی', 'preview-fleet-1'],
    ['hrSettings', 'تنظیمات و یکپارچگی', 'preview-hrSettings-1'],
  ] as const)('renders the %s capability preview', (section, title, id) => {
    const html = renderToStaticMarkup(<HrWorkspace sectionId={section} />);
    expect(html).toContain(title);
    expect(html).toContain(id);
    expect(html).toContain('فقط شناسه‌ها و ردیف‌های صریحاً نمایشی');
  });

  it('states the exact Iran localization boundary', () => {
    const html = renderToStaticMarkup(<HrWorkspace sectionId="hrSettings" />);
    expect(html).toContain('چندشرکتی و بومی‌سازی');
    expect(html).toContain('نیازمند اتصال');
    expect(iranLocalizationStatus).toEqual([
      {
        id: 'persian-calendar',
        label: 'تقویم شمسی رابط',
        status: 'IMPLEMENTED_IN_UI',
      },
      {
        id: 'insurance-export',
        label: 'خروجی بیمه ایران',
        status: 'BLOCKED_FOR_APPROVED_RULES',
      },
      {
        id: 'tax-export',
        label: 'خروجی مالیات ایران',
        status: 'BLOCKED_FOR_APPROVED_RULES',
      },
      {
        id: 'bank-export',
        label: 'خروجی بانکی ایران',
        status: 'BLOCKED_FOR_PUBLIC_CONTRACT',
      },
    ]);
  });

  it('uses the shared calendar picker and responsive internal scrolling', () => {
    const html = renderToStaticMarkup(<HrWorkspace sectionId="contracts" />);
    expect(html).toContain('id="hr-from-date"');
    expect(html).not.toMatch(/type="date"|type="datetime-local"/);
    const css = readFileSync(
      new URL('./hr-workspace.module.css', import.meta.url),
      'utf8',
    );
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('@media (max-width: 760px)');
    expect(css).toContain('grid-template-columns: 1fr');
  });

  it('normalizes unsupported routes to the hub', () => {
    expect(normalizeSection()).toBe('home');
    expect(normalizeSection('unknown')).toBe('home');
    expect(normalizeSection('finance')).toBe('finance');
  });

  it.each(['loading', 'empty', 'error', 'unauthorized', 'forbidden'] as const)(
    'renders the %s fallback without leaking private values',
    (state) => {
      const html = renderToStaticMarkup(<HrState state={state} />);
      expect(html).not.toContain('undefined');
      expect(html).not.toContain('preview-employee');
    },
  );
});
