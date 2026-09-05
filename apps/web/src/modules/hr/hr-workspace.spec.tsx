import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HrState, HrWorkspace } from './hr-workspace';
import {
  employeeTabs,
  hrHubCards,
  normalizeSection,
  sectionTabs,
} from './hr.model';

describe('HR reference implementation', () => {
  it('renders the twelve reference hub cards as deep links', () => {
    const html = renderToStaticMarkup(<HrWorkspace sectionId="home" />);
    expect(hrHubCards).toHaveLength(12);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('data-hr-mode="preview"');
    for (const card of hrHubCards) {
      expect(html).toContain(card.title);
      expect(html).toContain(`/hr?section=${card.id}`);
    }
  });

  it('keeps dashboard metrics unclaimed until an approved source exists', () => {
    const html = renderToStaticMarkup(<HrWorkspace sectionId="dashboard" />);
    expect(html.match(/داده متصل موجود نیست/g) ?? []).toHaveLength(8);
    expect(html).toContain('منبع عملیاتی متصل نیست');
    expect(html).toContain('خروجی داشبورد');
    expect(html).toContain('disabled');
  });

  it('provides the complete employee profile and section tab sets', () => {
    expect(employeeTabs).toHaveLength(15);
    expect(sectionTabs.organization).toHaveLength(3);
    expect(sectionTabs.contracts).toHaveLength(5);
    expect(sectionTabs.time).toHaveLength(5);
    expect(sectionTabs.development).toHaveLength(3);
    expect(sectionTabs.finance).toHaveLength(4);
    expect(sectionTabs.reports).toHaveLength(3);
    expect(sectionTabs.payroll).toHaveLength(8);
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
